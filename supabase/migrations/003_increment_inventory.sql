-- Atomic inventory restore used when cancelling orders
CREATE OR REPLACE FUNCTION increment_inventory(product_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET inventory = inventory + amount
  WHERE id = product_id;
END;
$$;
