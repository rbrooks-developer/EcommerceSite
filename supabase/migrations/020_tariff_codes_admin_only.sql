-- Remove public read access from tariff_codes; admins only via service role or is_admin()
DROP POLICY IF EXISTS "Public read tariff codes" ON public.tariff_codes;

-- Ensure the admin-manage policy covers SELECT as well (ALL includes SELECT)
DROP POLICY IF EXISTS "Admins manage tariff codes" ON public.tariff_codes;
CREATE POLICY "Admins manage tariff codes" ON public.tariff_codes FOR ALL USING (public.is_admin());
