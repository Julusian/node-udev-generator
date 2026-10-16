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

  // Flatten into one entry per rule, sorted by vendor id then product id so that the
  // output is stable no matter the order the definitions were provided in
  const entries: {
    vendorId: number;
    productId: number | null;
    bluetooth: boolean;
  }[] = [];
  for (const definition of definitions) {
    const bluetooth = !!definition.bluetooth;
    if (definition.productIds === null) {
      // A single rule for all products of this vendor
      entries.push({
        vendorId: definition.vendorId,
        productId: null,
        bluetooth,
      });
    } else {
      for (const productId of definition.productIds) {
        entries.push({ vendorId: definition.vendorId, productId, bluetooth });
      }
    }
  }
  entries.sort(
    (a, b) =>
      a.vendorId - b.vendorId || (a.productId ?? -1) - (b.productId ?? -1),
  );

  for (const entry of entries) {
    output += generateRuleForDevice(
      entry.vendorId.toString(16).padStart(4, "0"),
      entry.productId === null
        ? null
        : entry.productId.toString(16).padStart(4, "0"),
      entry.bluetooth,
      options,
    );
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
