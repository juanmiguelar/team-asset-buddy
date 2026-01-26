-- Fix remaining function search_path warning (update_updated_at_column)
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;