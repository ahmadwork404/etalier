ALTER TABLE tenants ADD COLUMN max_locations integer NOT NULL DEFAULT 1 CHECK (max_locations BETWEEN 1 AND 1000);
UPDATE tenants SET max_locations=GREATEST(1,(SELECT count(*)::integer FROM branches WHERE branches.tenant_id=tenants.id));
ALTER TABLE tenant_features ADD COLUMN admin_enabled boolean NOT NULL DEFAULT true;
UPDATE sessions SET tenant_id=NULL WHERE user_id IN (SELECT id FROM users WHERE platform_role IS NOT NULL);
