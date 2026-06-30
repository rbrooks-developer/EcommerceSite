export interface ShippingProtectionSettings {
  insurance_min_subtotal?: number | null;
  signature_min_subtotal?: number | null;
}

export interface ShippingProtection {
  insuranceRequired: boolean;
  signatureRequired: boolean;
}

/** A threshold of 0 means the protection is disabled. */
export function resolveShippingProtection(
  subtotal: number,
  settings: ShippingProtectionSettings | null,
): ShippingProtection {
  const insuranceMin = Number(settings?.insurance_min_subtotal ?? 0);
  const signatureMin = Number(settings?.signature_min_subtotal ?? 0);
  return {
    insuranceRequired: insuranceMin > 0 && subtotal >= insuranceMin,
    signatureRequired: signatureMin > 0 && subtotal >= signatureMin,
  };
}

/**
 * EasyPost charges 1% of declared value for insurance, $1 minimum (see
 * Shipment.insure docs) — billed to us when the label is purchased via
 * Shipment.buy(..., subtotal) in generateLabels(). That cost has to be
 * quoted to the customer up front, or the store eats it on every
 * high-value order.
 */
export function calculateInsuranceFee(subtotal: number, insuranceRequired: boolean): number {
  if (!insuranceRequired) return 0;
  return Math.max(1, subtotal * 0.01);
}
