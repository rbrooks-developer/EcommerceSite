export const FEATURE_SQL: Record<string, string> = {
  promos: `
CREATE TABLE IF NOT EXISTS promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed','free_shipping')),
  discount_value numeric NOT NULL DEFAULT 0,
  max_shipping_discount numeric,
  start_date timestamptz,
  expiration_date timestamptz,
  minimum_order numeric,
  maximum_order numeric,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  max_uses_per_customer integer,
  allow_international boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_promos (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES promos(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  customer_id uuid REFERENCES auth.users(id),
  customer_email text,
  discount_amount numeric NOT NULL DEFAULT 0,
  shipping_discount numeric NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_id uuid REFERENCES promos(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_discount numeric NOT NULL DEFAULT 0;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS promo_banner jsonb;
  `.trim(),

  ebay: `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ebay_config jsonb;`.trim(),

  aboutUs: `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS about_config jsonb;`.trim(),
};
