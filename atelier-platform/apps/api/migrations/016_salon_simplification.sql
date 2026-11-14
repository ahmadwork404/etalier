-- Temporarily disable optional growth and stock modules globally. Keep tenant
-- preferences intact so a platform administrator can restore them later.
UPDATE features SET enabled=false WHERE key IN ('reviews','ugc','automations','marketing','loyalty','memberships','gift_cards','inventory');
INSERT INTO audit_logs(action,metadata) VALUES('platform.modules.temporarily_disabled','{"modules":["reviews","ugc","automations","marketing","loyalty","memberships","gift_cards","inventory"]}'::jsonb);
ALTER TABLE customers ADD COLUMN is_walk_in boolean NOT NULL DEFAULT false;
UPDATE customers c SET is_walk_in=true WHERE EXISTS(SELECT 1 FROM quick_work_visits v WHERE v.tenant_id=c.tenant_id AND v.customer_id=c.id AND v.customer_type='walkin') AND NOT EXISTS(SELECT 1 FROM quick_work_visits v WHERE v.tenant_id=c.tenant_id AND v.customer_id=c.id AND v.customer_type='returning');
