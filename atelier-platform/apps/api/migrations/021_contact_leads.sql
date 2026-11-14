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
