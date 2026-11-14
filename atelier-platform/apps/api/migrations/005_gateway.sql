CREATE TABLE gateway_checkouts(id text PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),status text NOT NULL DEFAULT 'pending',expires_at timestamptz NOT NULL,FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id));
CREATE INDEX gateway_pending_order ON gateway_checkouts(tenant_id,order_id,status);
ALTER TABLE payments DROP CONSTRAINT payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK(method IN ('cash','card','bank_transfer','stripe','gift_card'));
CREATE UNIQUE INDEX payment_provider_reference ON payments(provider_reference) WHERE provider_reference IS NOT NULL;
