ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS max_image_size_mb integer DEFAULT 2;
