# udev-generator

A TypeScript library for generating udev rules for Linux devices.

## Installation

```bash
npm install udev-generator
```

## Usage

### Generating udev rules

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

### Output Format

The generator creates rules for hidraw devices only. Output follows standard udev rules format:

For desktop environments:

```
KERNEL=="hidraw*", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="660", TAG+="uaccess"
```

For headless environments:

```
KERNEL=="hidraw*", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="660", GROUP="companion"
```

## License

MIT
