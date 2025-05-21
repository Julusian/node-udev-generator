import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseUDevFile } from "../src/parser";
import { UdevRuleDefinition } from "../src/types";

describe("parseUDevFile", () => {
  it("should parse a simple udev rule file", () => {
    const content = `
      # This is a comment
      SUBSYSTEM=="input", GROUP="input", MODE="0666"

      # streamdeck
      SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
      KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", TAG+="uaccess"
    `;

    const result = parseUDevFile(content);
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

    const result = parseUDevFile(content);
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

    const result = parseUDevFile(content);
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

    const result = parseUDevFile(content);
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

    const result = parseUDevFile(content);

    // Sort the result by vendorId for consistent test results
    result.sort((a, b) => a.vendorId - b.vendorId);

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

    const result = parseUDevFile(content);

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

    const result = parseUDevFile(content);
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

    const result = parseUDevFile(content);
    expect(result).toEqual([
      {
        vendorId: 0x0fd9,
        productIds: null,
      },
    ]);
  });
});
