# udev-generator

A TypeScript library for generating udev rules for Linux devices.

## Installation

```bash
npm install udev-generator
```

## Usage

This library provides two approaches for generating udev rules: a functional API and a class-based generator.

### Functional API

```typescript
import { generateUdevFile, UdevRuleDefinition } from "udev-generator";

// Define your devices
const definitions: UdevRuleDefinition[] = [
  {
    vendorId: 0xffff, // Vendor ID in hexadecimal
    productIds: [0x1f40, 0x1f41], // Product IDs in hexadecimal
  },
  {
    vendorId: 0x0fd9,
    productIds: [0x0060, 0x0063, 0x006c],
  },
  {
    vendorId: 0xabcd,
    productIds: null, // null means all products from this vendor
  },
];

// Generate rules for desktop environment
const desktopRules = generateUdevFile(definitions, {
  mode: "desktop",
});

// Generate rules for headless environment with custom user group
const headlessRules = generateUdevFile(definitions, {
  mode: "headless",
  userGroup: "companion",
});

// Write to files
import { writeFileSync } from "fs";
writeFileSync("/etc/udev/rules.d/50-my-devices-desktop.rules", desktopRules);
writeFileSync("/etc/udev/rules.d/50-my-devices-headless.rules", headlessRules);
```

### Class-based Generator API

The `UdevRuleGenerator` class provides a more flexible approach for building rules incrementally or parsing existing rule files:

```typescript
import { UdevRuleGenerator } from "udev-generator";

// Create a new generator instance
const generator = new UdevRuleGenerator();

// Add individual devices
generator.addDevice(0xffff, 0x1f40);
generator.addDevice(0xffff, 0x1f41);

// Add all products from a vendor (wildcard)
generator.addVendorWildcard(0xabcd);

// Add multiple devices at once
generator.addRules([
  {
    vendorId: 0x0fd9,
    productIds: [0x0060, 0x0063, 0x006c],
  },
]);

// Parse and merge rules from existing files
import { readFileSync } from "fs";
const existingRules = readFileSync("/etc/udev/rules.d/existing.rules", "utf8");
generator.addFileContents(existingRules);

// Generate the final rules file
const rules = generator.generateFile({
  mode: "desktop", // or "headless"
  userGroup: "companion", // optional, only used in headless mode
});

// Access the current rule definitions
console.log(generator.rules);
```

### Output Format

The generator creates rules for hidraw devices. Output follows standard udev rules format:

For desktop environments:

```
KERNEL=="hidraw*", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="660", TAG+="uaccess"
```

For headless environments:

```
KERNEL=="hidraw*", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="660", GROUP="plugdev"
```

### API Reference

#### Types

```typescript
interface UdevRuleDefinition {
  vendorId: number;           // Vendor ID as decimal number
  productIds: number[] | null; // Array of product IDs, or null for all products
}

interface UdevGeneratorOptions {
  mode: "headless" | "desktop";
  userGroup?: string; // Only used in headless mode (default: "plugdev")
}
```

#### Functions

- `generateUdevFile(definitions: UdevRuleDefinition[], options: UdevGeneratorOptions): string`
  - Generates udev rules from an array of device definitions

#### UdevRuleGenerator Class

- `new UdevRuleGenerator()` - Create a new generator instance
- `addDevice(vendorId: number, productId: number): void` - Add a specific device
- `addVendorWildcard(vendorId: number): void` - Add all products from a vendor
- `addRules(rules: UdevRuleDefinition[]): void` - Add multiple rule definitions
- `addFileContents(content: string): void` - Parse and merge existing udev rules
- `generateFile(options: UdevGeneratorOptions): string` - Generate the final rules
- `rules: UdevRuleDefinition[]` - Get current rule definitions

## License

MIT
