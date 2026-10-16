export interface UdevRuleDefinition {
  /** The vendor id of the devices */
  vendorId: number;

  /** The product ids to allow, or null to allow any product ids */
  productIds: number[] | null;

  /** Also match the devices when connected over bluetooth (or another non-usb bus) */
  bluetooth?: boolean;
  // /** The usb interface to limit the rule to */
  // interface: number | null; // TODO - is this possible/wanted?
}
