export type PromoDiscountType = "percentage" | "fixed" | "free_shipping";

export type PromoForCalc = {
  discount_type: PromoDiscountType;
  discount_value: number;
  max_shipping_discount: number | null;
};

export type PromoDiscount = {
  discountAmount: number;   // reduction in merchandise subtotal
  shippingDiscount: number; // reduction in shipping
};

export function calculatePromoDiscount(
  promo: PromoForCalc,
  subtotal: number,
  shippingCost: number
): PromoDiscount {
  switch (promo.discount_type) {
    case "percentage": {
      const raw = Math.round(subtotal * (promo.discount_value / 100) * 100) / 100;
      return { discountAmount: Math.min(raw, subtotal), shippingDiscount: 0 };
    }
    case "fixed":
      return { discountAmount: Math.min(promo.discount_value, subtotal), shippingDiscount: 0 };
    case "free_shipping": {
      const shippingDiscount =
        promo.max_shipping_discount != null
          ? Math.min(shippingCost, promo.max_shipping_discount)
          : shippingCost;
      return { discountAmount: 0, shippingDiscount };
    }
    default:
      return { discountAmount: 0, shippingDiscount: 0 };
  }
}
