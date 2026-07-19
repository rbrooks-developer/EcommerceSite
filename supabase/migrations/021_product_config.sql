-- Add product_config JSONB column to site_settings for per-page pagination setting
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS product_config jsonb;
