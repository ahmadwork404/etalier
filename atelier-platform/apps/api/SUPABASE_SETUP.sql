-- Etalier: run ONCE in the Supabase SQL Editor on a new project.
-- The transaction rolls back completely if any statement fails.
BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());

-- 001_foundation.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL UNIQUE,password_hash text NOT NULL, name text NOT NULL, platform_role text CHECK(platform_role IN ('super_admin','support','analyst')), suspended boolean NOT NULL DEFAULT false, email_verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tenants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,slug text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),currency text NOT NULL DEFAULT 'PKR',timezone text NOT NULL DEFAULT 'Asia/Karachi',plan text NOT NULL DEFAULT 'starter',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE branches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,address text NOT NULL DEFAULT '', UNIQUE(tenant_id,id));
CREATE TABLE roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,is_owner boolean NOT NULL DEFAULT false,UNIQUE(tenant_id,name),UNIQUE(tenant_id,id));
CREATE TABLE role_permissions(role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,permission text NOT NULL,PRIMARY KEY(role_id,permission));
CREATE TABLE memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),user_id uuid NOT NULL REFERENCES users(id),role_id uuid NOT NULL,branch_id uuid,active boolean NOT NULL DEFAULT true,FOREIGN KEY(tenant_id,role_id) REFERENCES roles(tenant_id,id),FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),UNIQUE(tenant_id,user_id));
CREATE TABLE sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE features(key text PRIMARY KEY, name text NOT NULL,enabled boolean NOT NULL DEFAULT false,dependency text REFERENCES features(key),allowed_plans text[] NOT NULL DEFAULT ARRAY['starter','professional','enterprise']);
CREATE TABLE tenant_features(tenant_id uuid NOT NULL REFERENCES tenants(id),feature_key text NOT NULL REFERENCES features(key),enabled boolean NOT NULL DEFAULT false,settings jsonb NOT NULL DEFAULT '{}',PRIMARY KEY(tenant_id,feature_key));
CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants(id),actor_id uuid REFERENCES users(id),action text NOT NULL,target_id text,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX audit_tenant_time ON audit_logs(tenant_id,created_at DESC);
CREATE TABLE customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,email text,phone text,notes text NOT NULL DEFAULT '',marketing_consent boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,UNIQUE(tenant_id,id));
CREATE INDEX customer_tenant_name ON customers(tenant_id,name);
CREATE TABLE employees(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),branch_id uuid NOT NULL,name text NOT NULL,title text NOT NULL DEFAULT 'Stylist',active boolean NOT NULL DEFAULT true,FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),UNIQUE(tenant_id,id));
CREATE TABLE services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,duration_minutes integer NOT NULL CHECK(duration_minutes>0),buffer_minutes integer NOT NULL DEFAULT 0 CHECK(buffer_minutes>=0),price_minor bigint NOT NULL CHECK(price_minor>=0),active boolean NOT NULL DEFAULT true,UNIQUE(tenant_id,id));
CREATE TABLE appointments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),branch_id uuid NOT NULL,customer_id uuid NOT NULL,employee_id uuid NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show','rescheduled')),notes text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id),UNIQUE(tenant_id,id));
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT no_employee_overlap EXCLUDE USING gist(tenant_id WITH =,employee_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status NOT IN ('cancelled','no_show','rescheduled'));
CREATE INDEX appointment_tenant_date ON appointments(tenant_id,starts_at);
CREATE TABLE appointment_services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),appointment_id uuid NOT NULL,service_id uuid NOT NULL,price_minor bigint NOT NULL CHECK(price_minor>=0),duration_minutes integer NOT NULL CHECK(duration_minutes>0),FOREIGN KEY(tenant_id,appointment_id) REFERENCES appointments(tenant_id,id),FOREIGN KEY(tenant_id,service_id) REFERENCES services(tenant_id,id));
CREATE TABLE jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),feature_key text NOT NULL REFERENCES features(key),type text NOT NULL,payload jsonb NOT NULL DEFAULT '{}',deduplication_key text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed','disabled')),run_at timestamptz NOT NULL DEFAULT now(),attempts integer NOT NULL DEFAULT 0,max_attempts integer NOT NULL DEFAULT 5,last_error text,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX jobs_due ON jobs(status,run_at);
INSERT INTO features(key,name,enabled,dependency) VALUES ('customers','Customer CRM',true,null),('employees','Employee management',true,null),('services','Service catalog',true,null),('appointments','Appointment booking',true,null),('inventory','Inventory management',false,null),('pos','POS & orders',false,null),('email','Email notifications',false,null),('sms','SMS notifications',false,null),('whatsapp','WhatsApp notifications',false,null),('reviews','Review requests',false,'appointments'),('ugc','UGC collection',false,'appointments'),('marketing','Marketing campaigns',false,null),('loyalty','Loyalty program',false,'customers'),('memberships','Memberships',false,'customers'),('payments','Online payments',false,'pos'),('portal','Customer portal',false,'customers'),('public_booking','Public booking',false,'appointments'),('analytics','Advanced analytics',false,null),('ai','AI assistant',false,null);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['branches','roles','memberships','tenant_features','customers','employees','services','appointments','appointment_services','jobs'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t); END LOOP; END $$;

INSERT INTO schema_migrations(name) VALUES ('001_foundation.sql') ON CONFLICT(name) DO NOTHING;

-- 002_membership_lookup.sql
CREATE FUNCTION my_workspaces(requested_user uuid) RETURNS TABLE(id uuid,name text,slug text,status text) LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT t.id,t.name,t.slug,t.status FROM public.tenants t JOIN public.memberships m ON m.tenant_id=t.id WHERE m.user_id=requested_user AND m.active $$;
REVOKE ALL ON FUNCTION my_workspaces(uuid) FROM PUBLIC;
-- Grant EXECUTE to the dedicated runtime role at deployment; local postgres owns the function.

INSERT INTO schema_migrations(name) VALUES ('002_membership_lookup.sql') ON CONFLICT(name) DO NOTHING;

-- 003_operations.sql
ALTER TABLE tenants ADD COLUMN contact_email text, ADD COLUMN phone text, ADD COLUMN address text NOT NULL DEFAULT '', ADD COLUMN booking_min_hours integer NOT NULL DEFAULT 0 CHECK(booking_min_hours>=0), ADD COLUMN booking_max_days integer NOT NULL DEFAULT 180 CHECK(booking_max_days>0), ADD COLUMN cancel_hours integer NOT NULL DEFAULT 24 CHECK(cancel_hours>=0), ADD COLUMN tax_basis_points integer NOT NULL DEFAULT 0 CHECK(tax_basis_points BETWEEN 0 AND 10000), ADD COLUMN brand_color text NOT NULL DEFAULT '#284e40';
ALTER TABLE branches ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE customers ADD COLUMN birthday date, ADD COLUMN preferred_channel text NOT NULL DEFAULT 'email' CHECK(preferred_channel IN ('email','sms','whatsapp','none')), ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE employees ADD COLUMN email text, ADD COLUMN phone text, ADD COLUMN commission_basis_points integer NOT NULL DEFAULT 0 CHECK(commission_basis_points BETWEEN 0 AND 10000);
CREATE TABLE employee_schedules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),employee_id uuid NOT NULL,weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6),opens_at time NOT NULL,closes_at time NOT NULL CHECK(closes_at>opens_at),FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id),UNIQUE(tenant_id,employee_id,weekday));
CREATE TABLE employee_leaves(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),employee_id uuid NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),reason text NOT NULL DEFAULT '',FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id));
CREATE TABLE suppliers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,email text,phone text,UNIQUE(tenant_id,id));
CREATE TABLE products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,sku text NOT NULL,supplier_id uuid,cost_minor bigint NOT NULL DEFAULT 0 CHECK(cost_minor>=0),price_minor bigint NOT NULL CHECK(price_minor>=0),minimum_stock numeric(14,3) NOT NULL DEFAULT 5 CHECK(minimum_stock>=0),expires_on date,active boolean NOT NULL DEFAULT true,FOREIGN KEY(tenant_id,supplier_id) REFERENCES suppliers(tenant_id,id),UNIQUE(tenant_id,id),UNIQUE(tenant_id,sku));
CREATE TABLE inventory_balances(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,product_id uuid NOT NULL,quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK(quantity>=0),PRIMARY KEY(tenant_id,branch_id,product_id),FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id));
CREATE TABLE inventory_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),branch_id uuid NOT NULL,product_id uuid NOT NULL,quantity numeric(14,3) NOT NULL CHECK(quantity<>0),reason text NOT NULL,reference_id uuid,actor_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id));
CREATE INDEX inventory_movement_history ON inventory_movements(tenant_id,branch_id,created_at DESC);
CREATE TABLE service_consumables(tenant_id uuid NOT NULL,service_id uuid NOT NULL,product_id uuid NOT NULL,quantity numeric(14,3) NOT NULL CHECK(quantity>0),PRIMARY KEY(tenant_id,service_id,product_id),FOREIGN KEY(tenant_id,service_id) REFERENCES services(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id));
CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),branch_id uuid NOT NULL,customer_id uuid NOT NULL,appointment_id uuid,status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','paid','partially_refunded','refunded','void')),subtotal_minor bigint NOT NULL CHECK(subtotal_minor>=0),discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor>=0),tax_minor bigint NOT NULL DEFAULT 0 CHECK(tax_minor>=0),total_minor bigint NOT NULL CHECK(total_minor>=0),idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),FOREIGN KEY(tenant_id,appointment_id) REFERENCES appointments(tenant_id,id),UNIQUE(tenant_id,id),UNIQUE(tenant_id,idempotency_key),UNIQUE(tenant_id,appointment_id));
CREATE TABLE order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,order_id uuid NOT NULL,service_id uuid,product_id uuid,name text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),price_minor bigint NOT NULL CHECK(price_minor>=0),CHECK((service_id IS NULL)<>(product_id IS NULL)),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,service_id) REFERENCES services(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id));
CREATE TABLE payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,order_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),method text NOT NULL CHECK(method IN ('cash','card','bank_transfer','stripe')),idempotency_key text NOT NULL,provider_reference text,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),UNIQUE(tenant_id,id),UNIQUE(tenant_id,idempotency_key));
CREATE TABLE refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,payment_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),reason text NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,payment_id) REFERENCES payments(tenant_id,id),UNIQUE(tenant_id,idempotency_key));
CREATE TABLE commissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,employee_id uuid NOT NULL,appointment_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>=0),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id),FOREIGN KEY(tenant_id,appointment_id) REFERENCES appointments(tenant_id,id),UNIQUE(tenant_id,appointment_id));
CREATE TABLE expenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,branch_id uuid NOT NULL,name text NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),incurred_on date NOT NULL DEFAULT CURRENT_DATE,FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id));
CREATE TABLE consent_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,purpose text NOT NULL,granted boolean NOT NULL,actor_id uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['employee_schedules','employee_leaves','suppliers','products','inventory_balances','inventory_movements','service_consumables','orders','order_items','payments','refunds','commissions','expenses','consent_records'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t); END LOOP; END $$;

INSERT INTO schema_migrations(name) VALUES ('003_operations.sql') ON CONFLICT(name) DO NOTHING;

-- 004_engagement.sql
CREATE TABLE action_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),token_hash text NOT NULL UNIQUE,purpose text NOT NULL,user_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),customer_id uuid,resource_id uuid,email text,role_id uuid,branch_id uuid,expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),FOREIGN KEY(tenant_id,role_id) REFERENCES roles(tenant_id,id),FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id));
CREATE TABLE forms(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,fields jsonb NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id));
CREATE TABLE form_submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,form_id uuid NOT NULL,customer_id uuid NOT NULL,appointment_id uuid,answers jsonb NOT NULL,reviewed boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,form_id) REFERENCES forms(tenant_id,id),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),FOREIGN KEY(tenant_id,appointment_id) REFERENCES appointments(tenant_id,id));
CREATE TABLE reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,appointment_id uuid,rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),body text NOT NULL DEFAULT '',response text,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),FOREIGN KEY(tenant_id,appointment_id) REFERENCES appointments(tenant_id,id));
CREATE TABLE media(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,object_key text NOT NULL UNIQUE,content_type text NOT NULL,size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=52428800),verified boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),UNIQUE(tenant_id,id));
CREATE TABLE ugc_submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,media_id uuid,testimonial text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','withdrawn')),consent_granted boolean NOT NULL DEFAULT false,consent_text text NOT NULL,consent_expires_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),FOREIGN KEY(tenant_id,media_id) REFERENCES media(tenant_id,id));
CREATE TABLE workflows(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,name text NOT NULL,trigger text NOT NULL CHECK(trigger IN ('appointment.created','appointment.completed')),channel text NOT NULL CHECK(channel IN ('email','sms','whatsapp')),delay_minutes integer NOT NULL DEFAULT 0 CHECK(delay_minutes BETWEEN 0 AND 525600),subject text NOT NULL,body text NOT NULL,enabled boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id));
CREATE TABLE campaigns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,name text NOT NULL,channel text NOT NULL CHECK(channel IN ('email','sms','whatsapp')),subject text NOT NULL,body text NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','paused','completed')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id));
CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,channel text NOT NULL,subject text NOT NULL,body text NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed','suppressed')),provider_reference text,job_id uuid REFERENCES jobs(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),UNIQUE(tenant_id,id));
ALTER TABLE jobs ADD COLUMN lease_until timestamptz;
CREATE TABLE loyalty_accounts(tenant_id uuid NOT NULL,customer_id uuid NOT NULL,points integer NOT NULL DEFAULT 0 CHECK(points>=0),PRIMARY KEY(tenant_id,customer_id),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id));
CREATE TABLE loyalty_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,points integer NOT NULL CHECK(points<>0),reason text NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),UNIQUE(tenant_id,idempotency_key));
CREATE TABLE membership_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,name text NOT NULL,price_minor bigint NOT NULL CHECK(price_minor>=0),duration_days integer NOT NULL CHECK(duration_days>0),service_credits integer NOT NULL CHECK(service_credits>=0),UNIQUE(tenant_id,id));
CREATE TABLE customer_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,plan_id uuid NOT NULL,starts_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,credits_remaining integer NOT NULL CHECK(credits_remaining>=0),status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','expired')),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),FOREIGN KEY(tenant_id,plan_id) REFERENCES membership_plans(tenant_id,id),UNIQUE(tenant_id,id));
CREATE TABLE membership_redemptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,membership_id uuid NOT NULL,appointment_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,membership_id) REFERENCES customer_memberships(tenant_id,id),FOREIGN KEY(tenant_id,appointment_id) REFERENCES appointments(tenant_id,id),UNIQUE(tenant_id,appointment_id));
CREATE TABLE gift_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,code_hash text NOT NULL UNIQUE,last_four text NOT NULL,initial_minor bigint NOT NULL CHECK(initial_minor>0),balance_minor bigint NOT NULL CHECK(balance_minor>=0),expires_on date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id));
CREATE TABLE gift_card_redemptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,gift_card_id uuid NOT NULL,order_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,gift_card_id) REFERENCES gift_cards(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),UNIQUE(tenant_id,idempotency_key));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['forms','form_submissions','reviews','media','ugc_submissions','workflows','campaigns','notifications','loyalty_accounts','loyalty_transactions','membership_plans','customer_memberships','membership_redemptions','gift_cards','gift_card_redemptions'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t); END LOOP; END $$;
INSERT INTO features(key,name,enabled,dependency) VALUES('forms','Intake forms',true,'customers'),('automations','Workflow automations',false,'appointments'),('gift_cards','Gift cards',false,'pos');
INSERT INTO tenant_features(tenant_id,feature_key,enabled) SELECT id,'forms',true FROM tenants;
INSERT INTO tenant_features(tenant_id,feature_key,enabled) SELECT id,'automations',false FROM tenants;
INSERT INTO tenant_features(tenant_id,feature_key,enabled) SELECT id,'gift_cards',false FROM tenants;
CREATE TABLE gateway_events(id text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());

INSERT INTO schema_migrations(name) VALUES ('004_engagement.sql') ON CONFLICT(name) DO NOTHING;

-- 005_gateway.sql
CREATE TABLE gateway_checkouts(id text PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),status text NOT NULL DEFAULT 'pending',expires_at timestamptz NOT NULL,FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id));
CREATE INDEX gateway_pending_order ON gateway_checkouts(tenant_id,order_id,status);
ALTER TABLE payments DROP CONSTRAINT payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK(method IN ('cash','card','bank_transfer','stripe','gift_card'));
CREATE UNIQUE INDEX payment_provider_reference ON payments(provider_reference) WHERE provider_reference IS NOT NULL;

INSERT INTO schema_migrations(name) VALUES ('005_gateway.sql') ON CONFLICT(name) DO NOTHING;

-- 006_purchasing.sql
CREATE TABLE purchase_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,supplier_id uuid NOT NULL,branch_id uuid NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','received','cancelled')),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,supplier_id) REFERENCES suppliers(tenant_id,id),FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),UNIQUE(tenant_id,id));
CREATE TABLE purchase_order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,purchase_order_id uuid NOT NULL,product_id uuid NOT NULL,quantity numeric(14,3) NOT NULL CHECK(quantity>0),cost_minor bigint NOT NULL CHECK(cost_minor>=0),FOREIGN KEY(tenant_id,purchase_order_id) REFERENCES purchase_orders(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id));
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;CREATE POLICY tenant_scope ON purchase_orders USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;ALTER TABLE purchase_order_items FORCE ROW LEVEL SECURITY;CREATE POLICY tenant_scope ON purchase_order_items USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
UPDATE features SET enabled=true WHERE key IN ('inventory','pos','reviews','ugc','marketing','loyalty','memberships','gift_cards','forms','automations','analytics','payments','portal','public_booking','email','sms','whatsapp');

INSERT INTO schema_migrations(name) VALUES ('006_purchasing.sql') ON CONFLICT(name) DO NOTHING;

-- 007_privacy_payroll.sql
CREATE TABLE privacy_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,customer_id uuid NOT NULL,type text NOT NULL CHECK(type IN ('export','deletion','ugc_withdrawal')),status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','completed')),created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id));
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;ALTER TABLE privacy_requests FORCE ROW LEVEL SECURITY;CREATE POLICY tenant_scope ON privacy_requests USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE TABLE payroll_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,employee_id uuid NOT NULL,period_start date NOT NULL,period_end date NOT NULL CHECK(period_end>=period_start),base_minor bigint NOT NULL CHECK(base_minor>=0),bonus_minor bigint NOT NULL DEFAULT 0 CHECK(bonus_minor>=0),deduction_minor bigint NOT NULL DEFAULT 0 CHECK(deduction_minor>=0),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','paid')),paid_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id),UNIQUE(tenant_id,employee_id,period_start,period_end));
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;ALTER TABLE payroll_records FORCE ROW LEVEL SECURITY;CREATE POLICY tenant_scope ON payroll_records USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

INSERT INTO schema_migrations(name) VALUES ('007_privacy_payroll.sql') ON CONFLICT(name) DO NOTHING;

-- 008_platform_controls.sql
ALTER TABLE tenants ADD COLUMN max_locations integer NOT NULL DEFAULT 1 CHECK (max_locations BETWEEN 1 AND 1000);
UPDATE tenants SET max_locations=GREATEST(1,(SELECT count(*)::integer FROM branches WHERE branches.tenant_id=tenants.id));
ALTER TABLE tenant_features ADD COLUMN admin_enabled boolean NOT NULL DEFAULT true;
UPDATE sessions SET tenant_id=NULL WHERE user_id IN (SELECT id FROM users WHERE platform_role IS NOT NULL);

INSERT INTO schema_migrations(name) VALUES ('008_platform_controls.sql') ON CONFLICT(name) DO NOTHING;

-- 009_customer_photos.sql
ALTER TABLE media ADD COLUMN purpose text NOT NULL DEFAULT 'ugc' CHECK (purpose IN ('ugc','customer_photo'));
ALTER TABLE customers ADD COLUMN photo_media_id uuid;
ALTER TABLE customers ADD CONSTRAINT customer_photo_media_fk FOREIGN KEY(tenant_id,photo_media_id) REFERENCES media(tenant_id,id) ON DELETE SET NULL (photo_media_id);

INSERT INTO schema_migrations(name) VALUES ('009_customer_photos.sql') ON CONFLICT(name) DO NOTHING;

-- 010_default_store_currency.sql
-- New shops default to dollars. Existing configured currencies are preserved.
ALTER TABLE tenants ALTER COLUMN currency SET DEFAULT 'USD';

INSERT INTO schema_migrations(name) VALUES ('010_default_store_currency.sql') ON CONFLICT(name) DO NOTHING;

-- 011_service_images.sql
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

INSERT INTO schema_migrations(name) VALUES ('011_service_images.sql') ON CONFLICT(name) DO NOTHING;

-- 012_intake_forms.sql
ALTER TABLE forms ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE forms ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE intake_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, form_id uuid NOT NULL,
 customer_id uuid, token_hash text NOT NULL UNIQUE, fields_snapshot jsonb NOT NULL,
 name_snapshot text NOT NULL, description_snapshot text NOT NULL DEFAULT '',
 expires_at timestamptz NOT NULL, max_uses integer NOT NULL DEFAULT 1 CHECK(max_uses BETWEEN 1 AND 100),
 uses integer NOT NULL DEFAULT 0 CHECK(uses>=0 AND uses<=max_uses), revoked_at timestamptz,
 delivery text NOT NULL CHECK(delivery IN ('copy','email')),
 delivery_status text NOT NULL DEFAULT 'copy' CHECK(delivery_status IN ('copy','sending','sent','failed')),
 request_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,form_id) REFERENCES forms(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id)
);
CREATE UNIQUE INDEX intake_request_recipient ON intake_links(tenant_id,request_key,COALESCE(customer_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX intake_links_form ON intake_links(tenant_id,form_id,created_at DESC);
ALTER TABLE intake_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_links FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON intake_links USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE form_submissions ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE form_submissions ADD COLUMN link_id uuid REFERENCES intake_links(id);
ALTER TABLE form_submissions ADD COLUMN fields_snapshot jsonb;
ALTER TABLE form_submissions ADD COLUMN respondent_name text;
ALTER TABLE form_submissions ADD COLUMN respondent_email text;
ALTER TABLE form_submissions ADD COLUMN device jsonb NOT NULL DEFAULT '{}';
CREATE INDEX intake_responses_form ON form_submissions(tenant_id,form_id,created_at DESC);

INSERT INTO schema_migrations(name) VALUES ('012_intake_forms.sql') ON CONFLICT(name) DO NOTHING;

-- 013_intake_legacy_snapshots.sql
-- Preserve the questions visible at upgrade time for existing responses.
UPDATE form_submissions r SET fields_snapshot=f.fields
FROM forms f WHERE f.tenant_id=r.tenant_id AND f.id=r.form_id AND r.fields_snapshot IS NULL;

INSERT INTO schema_migrations(name) VALUES ('013_intake_legacy_snapshots.sql') ON CONFLICT(name) DO NOTHING;

-- 014_employee_profiles.sql
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

INSERT INTO schema_migrations(name) VALUES ('014_employee_profiles.sql') ON CONFLICT(name) DO NOTHING;

-- 015_quick_work.sql
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

INSERT INTO schema_migrations(name) VALUES ('015_quick_work.sql') ON CONFLICT(name) DO NOTHING;

-- 016_salon_simplification.sql
-- Temporarily disable optional growth and stock modules globally. Keep tenant
-- preferences intact so a platform administrator can restore them later.
UPDATE features SET enabled=false WHERE key IN ('reviews','ugc','automations','marketing','loyalty','memberships','gift_cards','inventory');
INSERT INTO audit_logs(action,metadata) VALUES('platform.modules.temporarily_disabled','{"modules":["reviews","ugc","automations","marketing","loyalty","memberships","gift_cards","inventory"]}'::jsonb);
ALTER TABLE customers ADD COLUMN is_walk_in boolean NOT NULL DEFAULT false;
UPDATE customers c SET is_walk_in=true WHERE EXISTS(SELECT 1 FROM quick_work_visits v WHERE v.tenant_id=c.tenant_id AND v.customer_id=c.id AND v.customer_type='walkin') AND NOT EXISTS(SELECT 1 FROM quick_work_visits v WHERE v.tenant_id=c.tenant_id AND v.customer_id=c.id AND v.customer_type='returning');

INSERT INTO schema_migrations(name) VALUES ('016_salon_simplification.sql') ON CONFLICT(name) DO NOTHING;

-- 017_sales_screens_paused.sql
-- Keep the checkout ledger available to Quick Work and reports; pause the
-- standalone sales administration screens and online payment checkout.
INSERT INTO features(key,name,enabled,dependency) VALUES('sales_management','Sales management',false,'pos');
INSERT INTO tenant_features(tenant_id,feature_key,enabled) SELECT id,'sales_management',true FROM tenants;
UPDATE features SET enabled=false WHERE key='payments';
INSERT INTO audit_logs(action,metadata) VALUES('platform.sales_screens.temporarily_disabled','{"modules":["sales_management","payments"]}'::jsonb);

INSERT INTO schema_migrations(name) VALUES ('017_sales_screens_paused.sql') ON CONFLICT(name) DO NOTHING;

-- 018_location_photos.sql
ALTER TABLE branches ADD COLUMN image_version uuid;
ALTER TABLE branches ADD COLUMN image_key text;

INSERT INTO schema_migrations(name) VALUES ('018_location_photos.sql') ON CONFLICT(name) DO NOTHING;

-- 019_payroll_cycles.sql
ALTER TABLE employees ADD COLUMN payroll_frequency text NOT NULL DEFAULT 'monthly' CHECK(payroll_frequency IN ('daily','weekly','biweekly','monthly'));
ALTER TABLE employees ADD COLUMN payroll_start_on date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE employees ADD COLUMN payroll_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE employee_leaves ADD COLUMN paid boolean NOT NULL DEFAULT true;
ALTER TABLE payroll_records ADD COLUMN commission_minor bigint NOT NULL DEFAULT 0 CHECK(commission_minor>=0);
ALTER TABLE payroll_records ADD COLUMN unpaid_leave_minor bigint NOT NULL DEFAULT 0 CHECK(unpaid_leave_minor>=0);
ALTER TABLE payroll_records ADD COLUMN deduction_reason text NOT NULL DEFAULT '';
ALTER TABLE payroll_records ADD COLUMN bonus_reason text NOT NULL DEFAULT '';
ALTER TABLE payroll_records ADD COLUMN automatic boolean NOT NULL DEFAULT false;
ALTER TABLE payroll_records ADD COLUMN calculation jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE payroll_records ADD COLUMN calculated_at timestamptz;
CREATE INDEX payroll_employee_period ON payroll_records(tenant_id,employee_id,period_start,period_end);

INSERT INTO schema_migrations(name) VALUES ('019_payroll_cycles.sql') ON CONFLICT(name) DO NOTHING;

-- 020_booking_advances.sql
ALTER TABLE appointments ADD COLUMN paid_in_advance boolean NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN booking_request_key uuid;
ALTER TABLE appointments ADD COLUMN booking_request_hash text;
CREATE UNIQUE INDEX appointment_request_unique ON appointments(tenant_id,booking_request_key) WHERE booking_request_key IS NOT NULL;

INSERT INTO schema_migrations(name) VALUES ('020_booking_advances.sql') ON CONFLICT(name) DO NOTHING;

-- 021_contact_leads.sql
CREATE TABLE contact_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key uuid NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  salon_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  team_size text NOT NULL DEFAULT '',
  message text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','closed','spam')),
  admin_notes text NOT NULL DEFAULT '',
  notification_status text NOT NULL DEFAULT 'pending' CHECK(notification_status IN ('pending','sending','sent','failed')),
  notification_attempts integer NOT NULL DEFAULT 0,
  notification_id text,
  notification_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_leads_created ON contact_leads(created_at DESC);
CREATE INDEX contact_leads_pending ON contact_leads(next_attempt_at) WHERE notification_status IN ('pending','sending');

INSERT INTO schema_migrations(name) VALUES ('021_contact_leads.sql') ON CONFLICT(name) DO NOTHING;

-- 022_supabase_api_permissions.sql
DO $$ DECLARE app_table text; public_role text; BEGIN FOREACH public_role IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=public_role) THEN FOREACH app_table IN ARRAY ARRAY['users','tenants','branches','roles','role_permissions','memberships','sessions','features','tenant_features','audit_logs','customers','employees','services','appointments','appointment_services','jobs','employee_schedules','employee_leaves','suppliers','products','inventory_balances','inventory_movements','service_consumables','orders','order_items','payments','refunds','commissions','expenses','consent_records','action_tokens','forms','form_submissions','reviews','media','ugc_submissions','workflows','campaigns','notifications','loyalty_accounts','loyalty_transactions','membership_plans','customer_memberships','membership_redemptions','gift_cards','gift_card_redemptions','gateway_events','gateway_checkouts','purchase_orders','purchase_order_items','privacy_requests','payroll_records','service_images','intake_links','employee_images','quick_work_visits','quick_work_services','contact_leads','schema_migrations'] LOOP IF to_regclass('public.'||app_table) IS NOT NULL THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',app_table,public_role); END IF; END LOOP; END IF; END LOOP; END $$;
INSERT INTO schema_migrations(name) VALUES ('022_supabase_api_permissions.sql') ON CONFLICT(name) DO NOTHING;

-- Replace this placeholder with a strong, private password before running.
CREATE ROLE etalier_app LOGIN NOBYPASSRLS PASSWORD 'REPLACE_WITH_PRIVATE_RUNTIME_PASSWORD';

GRANT USAGE ON SCHEMA public TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.users TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.tenants TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.branches TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.roles TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.role_permissions TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.memberships TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.sessions TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.features TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.tenant_features TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.audit_logs TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.customers TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.employees TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.services TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.appointments TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.appointment_services TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.jobs TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.employee_schedules TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.employee_leaves TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.suppliers TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.products TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.inventory_balances TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.inventory_movements TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.service_consumables TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.orders TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.order_items TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.payments TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.refunds TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.commissions TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.expenses TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.consent_records TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.action_tokens TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.forms TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.form_submissions TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.reviews TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.media TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.ugc_submissions TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.workflows TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.campaigns TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.notifications TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.loyalty_accounts TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.loyalty_transactions TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.membership_plans TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.customer_memberships TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.membership_redemptions TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.gift_cards TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.gift_card_redemptions TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.gateway_events TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.gateway_checkouts TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.purchase_orders TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.purchase_order_items TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.privacy_requests TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.payroll_records TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.service_images TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.intake_links TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.employee_images TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.quick_work_visits TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.quick_work_services TO etalier_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.contact_leads TO etalier_app;
GRANT SELECT ON TABLE public.schema_migrations TO etalier_app;
GRANT EXECUTE ON FUNCTION public.my_workspaces(uuid) TO etalier_app;
COMMIT;
