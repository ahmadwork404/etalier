CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX customers_name_search ON customers USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;
ALTER TABLE tenants ADD COLUMN payment_methods text[] NOT NULL DEFAULT ARRAY['cash','card','zelle','venmo','cash_app','other'] CHECK(cardinality(payment_methods)>0 AND payment_methods<@ARRAY['cash','card','zelle','venmo','cash_app','other','bank_transfer','stripe']::text[]);
ALTER TABLE payments DROP CONSTRAINT payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK(method IN ('cash','card','bank_transfer','stripe','zelle','venmo','cash_app','other'));
ALTER TABLE orders ADD COLUMN employee_id uuid;
ALTER TABLE orders ADD CONSTRAINT orders_employee_fk FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id);
ALTER TABLE orders ADD COLUMN tip_minor bigint NOT NULL DEFAULT 0 CHECK(tip_minor>=0 AND tip_minor<=total_minor);
ALTER TABLE order_items ADD COLUMN custom boolean NOT NULL DEFAULT false;
ALTER TABLE order_items DROP CONSTRAINT order_items_check;
ALTER TABLE order_items ADD CONSTRAINT order_item_kind CHECK((custom AND service_id IS NULL AND product_id IS NULL) OR (NOT custom AND ((service_id IS NULL)<>(product_id IS NULL))));
CREATE TABLE quick_work_visits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,branch_id uuid NOT NULL,customer_id uuid NOT NULL,employee_id uuid NOT NULL,
 order_id uuid NOT NULL,customer_type text NOT NULL CHECK(customer_type IN ('walkin','returning')),payment_method text NOT NULL,
 receipt_status text NOT NULL DEFAULT 'none' CHECK(receipt_status IN ('none','pending','sent','failed')),
 request_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),
 FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,request_key),UNIQUE(tenant_id,order_id)
);
CREATE TABLE quick_work_services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,visit_id uuid NOT NULL,service_id uuid,name text NOT NULL,price_minor bigint NOT NULL CHECK(price_minor>=0),
 FOREIGN KEY(tenant_id,visit_id) REFERENCES quick_work_visits(tenant_id,id),FOREIGN KEY(tenant_id,service_id) REFERENCES services(tenant_id,id)
);
ALTER TABLE commissions ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE commissions ADD COLUMN quick_visit_id uuid;
ALTER TABLE commissions ADD CONSTRAINT commissions_quick_fk FOREIGN KEY(tenant_id,quick_visit_id) REFERENCES quick_work_visits(tenant_id,id);
ALTER TABLE commissions ADD CONSTRAINT commissions_source CHECK((appointment_id IS NULL)<>(quick_visit_id IS NULL));
CREATE UNIQUE INDEX commissions_quick_unique ON commissions(tenant_id,quick_visit_id) WHERE quick_visit_id IS NOT NULL;
CREATE INDEX quick_visits_date ON quick_work_visits(tenant_id,created_at DESC);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['quick_work_visits','quick_work_services'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t); END LOOP; END $$;
