CREATE FUNCTION my_workspaces(requested_user uuid) RETURNS TABLE(id uuid,name text,slug text,status text) LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT t.id,t.name,t.slug,t.status FROM public.tenants t JOIN public.memberships m ON m.tenant_id=t.id WHERE m.user_id=requested_user AND m.active $$;
REVOKE ALL ON FUNCTION my_workspaces(uuid) FROM PUBLIC;
-- Grant EXECUTE to the dedicated runtime role at deployment; local postgres owns the function.
