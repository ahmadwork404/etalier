-- Preserve the questions visible at upgrade time for existing responses.
UPDATE form_submissions r SET fields_snapshot=f.fields
FROM forms f WHERE f.tenant_id=r.tenant_id AND f.id=r.form_id AND r.fields_snapshot IS NULL;
