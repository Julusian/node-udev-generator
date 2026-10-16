import { UdevRuleDefinition } from "./types";

export interface UdevGeneratorOptions {
  mode: "headless" | "desktop";
  /**
   * The user group to grant permissions to. Only used in headless mode.
   */
  userGroup?: string;
}

export function generateUdevFile(
  definitions: UdevRuleDefinition[],
  options: UdevGeneratorOptions,
): string {
  // Start with the standard input subsystem rule
  let output = 'SUBSYSTEM=="input", GROUP="input", MODE="0660"\n\n';

  // Process each device definition, sorted by vendor id so that the output is
  // stable no matter the order the definitions were provided in
  const sortedDefinitions = [...definitions].sort(
    (a, b) => a.vendorId - b.vendorId,
  );

  for (const definition of sortedDefinitions) {
    const vendorId = definition.vendorId.toString(16).padStart(4, "0");

    if (definition.productIds === null) {
      // Add a single rule for all products of this vendor
      output += generateRuleForDevice(
        vendorId,
        null,
        !!definition.bluetooth,
        options,
      );
    } else {
      // Add rules for each product ID
      const sortedIds = [...definition.productIds].sort((a, b) => a - b);
      for (const productId of sortedIds) {
        const productIdHex = productId.toString(16).padStart(4, "0");
        output += generateRuleForDevice(
          vendorId,
          productIdHex,
          !!definition.bluetooth,
          options,
        );
      }
    }
  }

  return output;
}

function generateRuleForDevice(
  vendorId: string,
  productId: string | null,
  bluetooth: boolean,
  options: UdevGeneratorOptions,
): string {
  const userGroup = options.userGroup || "plugdev";
  const vendorAttr = `ATTRS{idVendor}=="${vendorId}"`;
  const productAttr = productId ? `, ATTRS{idProduct}=="${productId}"` : "";

  // Define access permission based on mode
  const accessRule =
    options.mode === "desktop"
      ? 'MODE:="660", TAG+="uaccess"'
      : `MODE:="660", GROUP="${userGroup}"`;

  // For hidraw only
  let output = `KERNEL=="hidraw*", ${vendorAttr}${productAttr}, ${accessRule}\n`;

  if (bluetooth) {
    // The HID parent device is named BUS:VVVV:PPPP.NNNN in uppercase hex. Matching on this
    // covers devices without usb attributes, such as those connected over bluetooth
    const hidMatch = `KERNELS=="*:${vendorId.toUpperCase()}:${productId ? productId.toUpperCase() : "*"}.*"`;
    output += `KERNEL=="hidraw*", ${hidMatch}, ${accessRule}\n`;
  }

  return output;
}
