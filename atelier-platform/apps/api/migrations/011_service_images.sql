ALTER TABLE services ADD COLUMN icon_key text NOT NULL DEFAULT 'auto'
  CHECK (icon_key IN ('auto','haircut','color','wash','facial','nails','massage','brows'));
ALTER TABLE services ADD COLUMN image_version uuid;
CREATE TABLE service_images (
  tenant_id uuid NOT NULL,
  service_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 12 AND 2097152),
  PRIMARY KEY (tenant_id,service_id),
  FOREIGN KEY (tenant_id,service_id) REFERENCES services(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE service_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_images FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON service_images
 USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
