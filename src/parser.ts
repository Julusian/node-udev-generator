import { UdevRuleDefinition } from "./types";

/**
 * Parses a udev rules file and extracts device definitions
 *
 * @param content The content of the udev rules file
 * @returns An array of UdevRuleDefinition objects with merged/deduplicated entries
 */
export function parseUDevFile(content: string): UdevRuleDefinition[] {
  const lines = content.split("\n");
  const deviceMap = new Map<number, UdevRuleDefinition>();

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

      // Use the vendor ID directly as the key for merging

      if (!deviceMap.has(vendorId)) {
        deviceMap.set(vendorId, {
          vendorId,
          productIds: productId ? [productId] : null,
        });
      } else {
        const existing = deviceMap.get(vendorId)!;

        // If this rule has no product ID or the existing rule has no product ID,
        // set productIds to null (meaning all product IDs are allowed)
        if (productId === null || existing.productIds === null) {
          existing.productIds = null;
        }
        // Otherwise, add this product ID if it's not already in the array
        else if (
          productId !== null &&
          !existing.productIds.includes(productId)
        ) {
          existing.productIds.push(productId);
        }
      }
    }
  }

  // Convert map values to array
  return Array.from(deviceMap.values());
}
