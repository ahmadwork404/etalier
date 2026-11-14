ALTER TABLE employees ADD COLUMN base_salary_minor bigint NOT NULL DEFAULT 0 CHECK(base_salary_minor BETWEEN 0 AND 1000000000);
ALTER TABLE employees ADD COLUMN image_version uuid;
CREATE TABLE employee_images (
 tenant_id uuid NOT NULL,employee_id uuid NOT NULL,content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 data bytea NOT NULL CHECK(octet_length(data) BETWEEN 12 AND 2097152),
 PRIMARY KEY(tenant_id,employee_id),FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE employee_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_images FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON employee_images USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
