-- DEFERRED — run only after a stable release with v2 UI + backfills verified.
-- Review RLS, dependent views, and Edge Functions before uncommenting.
--
-- DROP VIEW IF EXISTS ...;
-- DROP TABLE IF EXISTS public.inventory_lots CASCADE;
-- DROP TABLE IF EXISTS public.inventory CASCADE;
-- DROP TABLE IF EXISTS public.deliveries CASCADE;
-- DROP TABLE IF EXISTS public.agent_expenses CASCADE;
-- DROP TABLE IF EXISTS public.general_expenses CASCADE;
-- -- Legacy `orders` / `order_items` if still present:
-- DROP TABLE IF EXISTS public.order_items CASCADE;
-- DROP TABLE IF EXISTS public.orders CASCADE;

COMMENT ON SCHEMA public IS 'See 999_deferred_drop_legacy_README.sql before dropping legacy tables.';
