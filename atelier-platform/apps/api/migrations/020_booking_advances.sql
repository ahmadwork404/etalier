ALTER TABLE appointments ADD COLUMN paid_in_advance boolean NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN booking_request_key uuid;
ALTER TABLE appointments ADD COLUMN booking_request_hash text;
CREATE UNIQUE INDEX appointment_request_unique ON appointments(tenant_id,booking_request_key) WHERE booking_request_key IS NOT NULL;
