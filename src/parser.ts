import { UdevDeviceOptions, UdevRuleDefinition } from "./types";
import { generateUdevFile, UdevGeneratorOptions } from "./generator";

function resolveBluetooth(options: UdevDeviceOptions | boolean | undefined) {
  // Support the deprecated boolean argument
  if (typeof options === "boolean") return options;
  return !!options?.bluetooth;
}

interface VendorEntry {
  vendorId: number;
  /** Product ids mapped to whether they are wanted over bluetooth, or null to allow any product ids */
  productIds: Map<number, boolean> | null;
  /** Whether the wildcard is wanted over bluetooth. Only used when productIds is null */
  bluetooth: boolean;
}

export class UdevRuleGenerator {
  private deviceMap: Map<number, VendorEntry> = new Map();

  /**
   * Get the current set of rules
   *
   * The rules are sorted by vendor id, with the product ids of each sorted numerically,
   * so that the result is stable no matter the order they were added in.
   * A vendor with a mix of bluetooth and non-bluetooth products is split into one rule for each.
   */
  get rules(): UdevRuleDefinition[] {
    const result: UdevRuleDefinition[] = [];

    const sortedEntries = Array.from(this.deviceMap.values()).sort(
      (a, b) => a.vendorId - b.vendorId,
    );
    for (const entry of sortedEntries) {
      if (entry.productIds === null) {
        const rule: UdevRuleDefinition = {
          vendorId: entry.vendorId,
          productIds: null,
        };
        if (entry.bluetooth) rule.bluetooth = true;
        result.push(rule);
        continue;
      }

      const plainIds: number[] = [];
      const bluetoothIds: number[] = [];
      for (const [productId, bluetooth] of entry.productIds) {
        if (bluetooth) bluetoothIds.push(productId);
        else plainIds.push(productId);
      }

      const groups: UdevRuleDefinition[] = [];
      if (plainIds.length) {
        groups.push({ vendorId: entry.vendorId, productIds: plainIds });
      }
      if (bluetoothIds.length) {
        groups.push({
          vendorId: entry.vendorId,
          productIds: bluetoothIds,
          bluetooth: true,
        });
      }

      for (const group of groups) group.productIds!.sort((a, b) => a - b);
      groups.sort((a, b) => a.productIds![0] - b.productIds![0]);

      result.push(...groups);
    }

    return result;
  }

  /**
   * Parse and add rules from an existing udev rules file content
   *
   * @param content The content of the udev rules file
   */
  addFileContents(content: string): void {
    const lines = content.split("\n");

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith("#")) {
        continue;
      }

      // Extract vendor ID and product ID if they exist in the line
      const vendorMatch = line.match(/ATTRS\{idVendor\}=="([0-9a-f]{4})"/i);
      const productMatch = line.match(/ATTRS\{idProduct\}=="([0-9a-f]{4})"/i);

      // A match on the HID device name means the device is wanted over bluetooth
      const hidMatch = line.match(
        /KERNELS=="(?:\*|[0-9a-f]{4}):([0-9a-f]{4}):([0-9a-f]{4}|\*)\.\*"/i,
      );

      if (vendorMatch) {
        const vendorId = parseInt(vendorMatch[1], 16);
        const productId = productMatch ? parseInt(productMatch[1], 16) : null;

        if (productId !== null) {
          this.addDevice(vendorId, productId);
        } else {
          this.addVendorWildcard(vendorId);
        }
      } else if (hidMatch) {
        const vendorId = parseInt(hidMatch[1], 16);
        const productId =
          hidMatch[2] === "*" ? null : parseInt(hidMatch[2], 16);

        if (productId !== null) {
          this.addDevice(vendorId, productId, { bluetooth: true });
        } else {
          this.addVendorWildcard(vendorId, { bluetooth: true });
        }
      }
    }
  }

  /**
   * Add a specific device by vendor and product ID
   *
   * @param vendorId The vendor ID in decimal (e.g., 1234)
   * @param productId The product ID in decimal (e.g., 5678)
   * @param options Options for the device
   */
  addDevice(
    vendorId: number,
    productId: number,
    options?: UdevDeviceOptions,
  ): void;
  /** @deprecated Pass `{ bluetooth }` as the options instead */
  addDevice(vendorId: number, productId: number, bluetooth: boolean): void;
  addDevice(
    vendorId: number,
    productId: number,
    options?: UdevDeviceOptions | boolean,
  ): void {
    const bluetooth = resolveBluetooth(options);

    const existing = this.deviceMap.get(vendorId);
    if (!existing) {
      this.deviceMap.set(vendorId, {
        vendorId,
        productIds: new Map([[productId, bluetooth]]),
        bluetooth: false,
      });
      return;
    }

    // If the existing entry has wildcarded product IDs, no need to add specific ones
    if (existing.productIds === null) {
      if (bluetooth) existing.bluetooth = true;
      return;
    }

    existing.productIds.set(
      productId,
      bluetooth || !!existing.productIds.get(productId),
    );
  }

  /**
   * Add multiple rules from an array of UdevRuleDefinition objects
   *
   * @param rules Array of UdevRuleDefinition objects to add
   */
  addRules(rules: UdevRuleDefinition[]): void {
    if (!Array.isArray(rules))
      throw new TypeError("Expected an array of rules");

    for (const rule of rules) {
      if (rule.productIds === null) {
        this.addVendorWildcard(rule.vendorId, { bluetooth: rule.bluetooth });
      } else {
        for (const productId of rule.productIds) {
          this.addDevice(rule.vendorId, productId, {
            bluetooth: rule.bluetooth,
          });
        }
      }
    }
  }

  /**
   * Add a vendor with wildcard for all its product IDs
   *
   * @param vendorId The vendor ID in decimal (e.g., 1234)
   * @param options Options for the vendor's devices
   */
  addVendorWildcard(vendorId: number, options?: UdevDeviceOptions): void;
  /** @deprecated Pass `{ bluetooth }` as the options instead */
  addVendorWildcard(vendorId: number, bluetooth: boolean): void;
  addVendorWildcard(
    vendorId: number,
    options?: UdevDeviceOptions | boolean,
  ): void {
    const bluetooth = resolveBluetooth(options);

    // Keep bluetooth if it was wanted for the vendor or any of its products
    const existing = this.deviceMap.get(vendorId);
    const existingBluetooth = existing
      ? existing.productIds === null
        ? existing.bluetooth
        : Array.from(existing.productIds.values()).some((bt) => bt)
      : false;

    // Always replace with wildcard regardless of existing entries
    this.deviceMap.set(vendorId, {
      vendorId,
      productIds: null, // null means all product IDs are allowed
      bluetooth: bluetooth || existingBluetooth,
    });
  }

  /**
   * Generate a udev rules file from the current rules
   *
   * @param options Generator options
   * @returns Generated udev rules content
   */
  generateFile(options: UdevGeneratorOptions): string {
    return generateUdevFile(this.rules, options);
  }
}
