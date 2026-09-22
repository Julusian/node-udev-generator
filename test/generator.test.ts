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

  it("generates the same output regardless of the order of the definitions", () => {
    const definitions: UdevRuleDefinition[] = [
      {
        vendorId: 0x0fd9,
        productIds: [0x0086, 0x0060, 0x0063],
      },
      {
        vendorId: 0x05f3,
        productIds: null,
      },
      {
        vendorId: 0xffff,
        productIds: [0x1f41],
      },
    ];
    const reversed: UdevRuleDefinition[] = [
      {
        vendorId: 0xffff,
        productIds: [0x1f41],
      },
      {
        vendorId: 0x05f3,
        productIds: null,
      },
      {
        vendorId: 0x0fd9,
        productIds: [0x0063, 0x0086, 0x0060],
      },
    ];

    const output = generateUdevFile(definitions, { mode: "desktop" });

    expect(output).toBe(
      'SUBSYSTEM=="input", GROUP="input", MODE="0660"\n' +
        "\n" +
        'KERNEL=="hidraw*", ATTRS{idVendor}=="05f3", MODE:="660", TAG+="uaccess"\n' +
        'KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="660", TAG+="uaccess"\n' +
        'KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0063", MODE:="660", TAG+="uaccess"\n' +
        'KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0086", MODE:="660", TAG+="uaccess"\n' +
        'KERNEL=="hidraw*", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f41", MODE:="660", TAG+="uaccess"\n',
    );
    expect(generateUdevFile(reversed, { mode: "desktop" })).toBe(output);
  });

  it("does not mutate the definitions passed in", () => {
    const definitions: UdevRuleDefinition[] = [
      {
        vendorId: 0xffff,
        productIds: [0x1f41],
      },
      {
        vendorId: 0x0fd9,
        productIds: [0x0063, 0x0060],
      },
    ];

    generateUdevFile(definitions, { mode: "desktop" });

    expect(definitions).toEqual([
      {
        vendorId: 0xffff,
        productIds: [0x1f41],
      },
      {
        vendorId: 0x0fd9,
        productIds: [0x0063, 0x0060],
      },
    ]);
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
