import { UdevRuleDefinition } from "./types";
import { generateUdevFile, UdevGeneratorOptions } from "./generator";

export class UdevRuleGenerator {
  private deviceMap: Map<number, UdevRuleDefinition> = new Map();

  /**
   * Get the current set of rules
   */
  get rules(): UdevRuleDefinition[] {
    return Array.from(this.deviceMap.values());
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

      if (vendorMatch) {
        const vendorId = parseInt(vendorMatch[1], 16);
        const productId = productMatch ? parseInt(productMatch[1], 16) : null;

        if (productId !== null) {
          this.addDevice(vendorId, productId);
        } else {
          this.addVendorWildcard(vendorId);
        }
      }
    }
  }

  /**
   * Add a specific device by vendor and product ID
   *
   * @param vendorId The vendor ID in decimal (e.g., 1234)
   * @param productId The product ID in decimal (e.g., 5678)
   */
  addDevice(vendorId: number, productId: number): void {
    if (!this.deviceMap.has(vendorId)) {
      this.deviceMap.set(vendorId, {
        vendorId,
        productIds: [productId],
      });
    } else {
      const existing = this.deviceMap.get(vendorId)!;

      // If the existing entry has wildcarded product IDs, no need to add specific ones
      if (existing.productIds === null) {
        return;
      }

      // Add the product ID if it doesn't already exist
      if (!existing.productIds.includes(productId)) {
        existing.productIds.push(productId);
      }
    }
  }

  /**
   * Add a vendor with wildcard for all its product IDs
   *
   * @param vendorId The vendor ID in decimal (e.g., 1234)
   */
  addVendorWildcard(vendorId: number): void {
    // Always replace with wildcard regardless of existing entries
    this.deviceMap.set(vendorId, {
      vendorId,
      productIds: null, // null means all product IDs are allowed
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
