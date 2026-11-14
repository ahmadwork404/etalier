ALTER TABLE media ADD COLUMN purpose text NOT NULL DEFAULT 'ugc' CHECK (purpose IN ('ugc','customer_photo'));
ALTER TABLE customers ADD COLUMN photo_media_id uuid;
ALTER TABLE customers ADD CONSTRAINT customer_photo_media_fk FOREIGN KEY(tenant_id,photo_media_id) REFERENCES media(tenant_id,id) ON DELETE SET NULL (photo_media_id);
