-- New shops default to dollars. Existing configured currencies are preserved.
ALTER TABLE tenants ALTER COLUMN currency SET DEFAULT 'USD';
