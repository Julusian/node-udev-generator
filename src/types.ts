export interface UdevRuleDefinition {
  /** The vendor id of the devices */
  vendorId: number;

  /** The product ids to allow, or null to allow any product ids */
  productIds: number[] | null;
  // /** The usb interface to limit the rule to */
  // interface: number | null; // TODO - is this possible/wanted?
}
