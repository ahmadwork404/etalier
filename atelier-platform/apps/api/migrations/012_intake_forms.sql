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
