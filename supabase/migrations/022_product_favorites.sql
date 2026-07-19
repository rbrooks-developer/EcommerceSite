CREATE TABLE IF NOT EXISTS public.product_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites" ON public.product_favorites
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS product_favorites_user_id_idx ON public.product_favorites(user_id);
CREATE INDEX IF NOT EXISTS product_favorites_product_id_idx ON public.product_favorites(product_id);
