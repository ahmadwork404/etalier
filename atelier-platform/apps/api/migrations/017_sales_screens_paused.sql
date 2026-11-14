-- Keep the checkout ledger available to Quick Work and reports; pause the
-- standalone sales administration screens and online payment checkout.
INSERT INTO features(key,name,enabled,dependency) VALUES('sales_management','Sales management',false,'pos');
INSERT INTO tenant_features(tenant_id,feature_key,enabled) SELECT id,'sales_management',true FROM tenants;
UPDATE features SET enabled=false WHERE key='payments';
INSERT INTO audit_logs(action,metadata) VALUES('platform.sales_screens.temporarily_disabled','{"modules":["sales_management","payments"]}'::jsonb);
