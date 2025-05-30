import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { UdevRuleGenerator } from "../src/parser";
import { UdevRuleDefinition } from "../src/types";

describe("UdevRuleGenerator", () => {
  it("should parse a simple udev rule file", () => {
    const content = `
      # This is a comment
      SUBSYSTEM=="input", GROUP="input", MODE="0666"

      # streamdeck
      SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
      KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
    `;

    const generator = new UdevRuleGenerator();
    generator.addFileContents(content);
    const result = generator.rules;

    expect(result).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: [0x0060],
      },
    ]);
  });

  it("should merge rules with the same vendor ID but different product IDs", () => {
    const content = `
      SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
      SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0063", MODE:="666", TAG+="uaccess"
      KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
    `;

    const generator = new UdevRuleGenerator();
    generator.addFileContents(content);
    const result = generator.rules;

    expect(result).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: [0x0060, 0x0063],
      },
    ]);
  });

  it("should set productIds to null if product ID is not specified", () => {
    const content = `
      # xkeys
      SUBSYSTEM=="usb", ATTRS{idVendor}=="05f3", MODE:="666", TAG+="uaccess"
      KERNEL=="hidraw*", ATTRS{idVendor}=="05f3", MODE:="666", TAG+="uaccess"
    `;

    const generator = new UdevRuleGenerator();
    generator.addFileContents(content);
    const result = generator.rules;

    expect(result).toEqual([
      {
        vendorId: 0x05f3,
        productIds: null,
      },
    ]);
  });

  it("should deduplicate identical product IDs", () => {
    const content = `
      SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
      KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
    `;

    const generator = new UdevRuleGenerator();
    generator.addFileContents(content);
    const result = generator.rules;

    expect(result).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: [0x0060],
      },
    ]);
  });

  it("should handle multiple vendors", () => {
    const content = `
      SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
      SUBSYSTEM=="usb", ATTRS{idVendor}=="05f3", MODE:="666", TAG+="uaccess"
      SUBSYSTEM=="usb", ATTRS{idVendor}=="1edb", ATTRS{idProduct}=="bef0", MODE:="666", TAG+="uaccess"
    `;

    const generator = new UdevRuleGenerator();
    generator.addFileContents(content);
    let result = generator.rules;

    // Sort the result by vendorId for consistent test results
    result = [...result].sort((a, b) => a.vendorId - b.vendorId);

    expect(result).toEqual([
      {
        vendorId: 0x05f3,
        productIds: null,
      },
      {
        vendorId: 0x0fd9,
        productIds: [0x0060],
      },
      {
        vendorId: 0x1edb,
        productIds: [0xbef0],
      },
    ]);
  });

  it("should parse actual sample files", () => {
    // Read the sample file
    const samplePath = path.join(
      __dirname,
      "..",
      "samples",
      "50-companion-desktop.rules",
    );
    const content = fs.readFileSync(samplePath, "utf-8");

    const generator = new UdevRuleGenerator();
    generator.addFileContents(content);
    const result = generator.rules;

    // Verify some expected results
    expect(result.length).toBeGreaterThan(0);

    // Check for streamdeck entries
    const streamdeck = result.find((r) => r.vendorId === 0x0fd9);
    expect(streamdeck).toBeDefined();
    expect(streamdeck?.productIds).toBeInstanceOf(Array);
    expect(streamdeck?.productIds?.length).toBeGreaterThan(0);

    // Check for xkeys entry
    const xkeys = result.find((r) => r.vendorId === 0x05f3);
    expect(xkeys).toBeDefined();
  });

  it("should combine rule with no product id and with a product id", () => {
    const content = `
      SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
      KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", MODE:="666", TAG+="uaccess"
    `;

    const generator = new UdevRuleGenerator();
    generator.addFileContents(content);
    const result = generator.rules;

    expect(result).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: null,
      },
    ]);
  });

  it("should combine rule with no product id and with a product id (other order)", () => {
    const content = `
      KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", MODE:="666", TAG+="uaccess"
      SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
    `;

    const generator = new UdevRuleGenerator();
    generator.addFileContents(content);
    const result = generator.rules;

    expect(result).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: null,
      },
    ]);
  });

  // New tests for UdevRuleGenerator specific methods
  it("should allow adding a single device", () => {
    const generator = new UdevRuleGenerator();
    generator.addDevice(0x0fd9, 0x0060);
    generator.addDevice(0x0fd9, 0x0063);

    expect(generator.rules).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: [0x0060, 0x0063],
      },
    ]);
  });

  it("should allow adding a vendor wildcard", () => {
    const generator = new UdevRuleGenerator();
    generator.addVendorWildcard(0x05f3);

    expect(generator.rules).toEqual([
      {
        vendorId: 0x05f3,
        productIds: null,
      },
    ]);
  });

  it("should prioritize vendor wildcard over specific product IDs", () => {
    const generator = new UdevRuleGenerator();
    generator.addDevice(0x0fd9, 0x0060);
    generator.addVendorWildcard(0x0fd9);

    expect(generator.rules).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: null,
      },
    ]);
  });

  it("should ignore adding product IDs to a vendor with wildcard", () => {
    const generator = new UdevRuleGenerator();
    generator.addVendorWildcard(0x0fd9);
    generator.addDevice(0x0fd9, 0x0060);

    expect(generator.rules).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: null,
      },
    ]);
  });

  it("should generate a file using the generator function", () => {
    const generator = new UdevRuleGenerator();
    generator.addDevice(0x0fd9, 0x0060);

    const output = generator.generateFile({ mode: "desktop" });

    expect(output).toContain('SUBSYSTEM=="input"');
    expect(output).toContain('ATTRS{idVendor}=="0fd9"');
    expect(output).toContain('ATTRS{idProduct}=="0060"');
    expect(output).toContain('TAG+="uaccess"');
  });
});
