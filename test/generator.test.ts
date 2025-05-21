import { describe, it, expect } from "vitest";
import { generateUdevFile } from "../src/generator";
import { UdevRuleDefinition } from "../src/types";

describe("UDev Generator", () => {
  it("generates desktop rules with specific product IDs", () => {
    const definitions: UdevRuleDefinition[] = [
      {
        vendorId: 0xffff,
        productIds: [0x1f40, 0x1f41],
      },
    ];

    const output = generateUdevFile(definitions, { mode: "desktop" });
    expect(output).toContain('SUBSYSTEM=="input"');
    expect(output).toContain(
      'KERNEL=="hidraw*", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="660", TAG+="uaccess"',
    );
    expect(output).toContain(
      'KERNEL=="hidraw*", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f41", MODE:="660", TAG+="uaccess"',
    );
  });

  it("generates headless rules with specific product IDs and custom group", () => {
    const definitions: UdevRuleDefinition[] = [
      {
        vendorId: 0x0fd9,
        productIds: [0x0060, 0x0063],
      },
    ];

    const output = generateUdevFile(definitions, {
      mode: "headless",
      userGroup: "companion",
    });
    expect(output).toContain('SUBSYSTEM=="input"');
    expect(output).toContain(
      'KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="660", GROUP="companion"',
    );
    expect(output).toContain(
      'KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0063", MODE:="660", GROUP="companion"',
    );
  });

  it("handles wildcard product IDs", () => {
    const definitions: UdevRuleDefinition[] = [
      {
        vendorId: 0xabcd,
        productIds: null, // all products
      },
    ];

    const output = generateUdevFile(definitions, { mode: "desktop" });
    expect(output).toContain(
      'KERNEL=="hidraw*", ATTRS{idVendor}=="abcd", MODE:="660", TAG+="uaccess"',
    );
  });
});
