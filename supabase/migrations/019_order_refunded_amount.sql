ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0;
