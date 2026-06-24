-- ============================================================
-- 008_storage_policies.sql
-- Run this in the Supabase SQL editor.
--
-- Creates the product-images bucket and its RLS policies.
-- Requires migration 007 (is_admin function) to be run first.
-- ============================================================

-- Create the bucket (no-op if it already exists from the dashboard)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Public read (bucket is public, but an explicit policy is still required)
CREATE POLICY "Product images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Admins can upload
CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

-- Admins can replace / update
CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- Admins can delete
CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
