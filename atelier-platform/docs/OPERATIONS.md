# Operations and security

Run PostgreSQL migrations with a dedicated schema owner; use a non-superuser runtime role without BYPASSRLS or CREATE privileges. Grant required table operations explicitly; audit_logs should be append-only for runtime. RLS is enabled and forced on scoped foundation tables. role_permissions must only be queried after resolving a role through its scoped tenant; sessions/users and platform tables are accessed through authenticated service boundaries.

The `my_workspaces` SECURITY DEFINER function only enumerates memberships and returns business summaries. Its definer needs cross-tenant membership access. Fix its search_path, revoke PUBLIC execution, grant only the runtime role. Never grant arbitrary SQL execution to application users. The function argument comes from a validated session, never browser input.

Reverse proxy Next.js with TLS; keep the API private. Set NODE_ENV=production and WEB_ORIGIN to the exact HTTPS app origin. HttpOnly cookies use Secure in production. Origin checks reject browser mutations from other origins. Configure trusted reverse-proxy IP handling before relying on distributed rate limits. Current rate limits are per-process; Redis/distributed protection is required for multiple API replicas. No secret values or request bodies should enter logs.

Verification, password reset, invitations and failed-login audit records are now implemented. Production enforces verified email for protected operations. Optional MFA, distributed account/IP brute-force controls, external error monitoring and full request IDs remain outstanding.

Backup PostgreSQL daily using pg_dump --format=custom with credentials injected through a secret manager or PGPASSFILE; encrypt the resulting archive outside source control. Define retention and offsite replication. Restore only into an isolated database with pg_restore, apply pending migrations, and verify row counts, constraints and tenant-isolation tests. A documented backup strategy is not a tested restore: disaster recovery drills remain required.

For S3, use private buckets, scoped signed URLs, content sniffing, size limits, quarantine/scanning, consent checks and retention policies. Private signed URLs, type/size/signature verification and consent checks are implemented. Production malware quarantine/scanning and automated retention remain outstanding.

## Current service additions

The notification worker now supports queued workflow/campaign delivery and provider idempotency for Resend. Jobs are claimed durably before provider delivery; a worker crash after a claim leaves a processing job for reconciliation instead of automatically sending it again. There is no blanket guarantee of exactly-once delivery across external providers. Monitor processing/failed jobs before production use.

Stripe, Twilio, Resend and Cloudflare documentation used for adapters:
- https://docs.stripe.com/webhooks/signature
- https://www.twilio.com/docs/messaging/api/message-resource
- https://resend.com/docs/api-reference/emails/send-email
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/

Run backups with an administrative connection separate from the runtime role. The user-supplied local postgres connection bypasses RLS; API predicates and integration tests are not a replacement for a least-privileged production database account. Docker, restore drills, full accessibility checks and external provider sandbox flows have not yet been verified.

## Verified local recovery drill

`npx tsx src/restore-check.ts` ran successfully against PostgreSQL 18. A custom-format dump was restored into a newly created `atelier_restore_qa_*` database, row counts matched for all 53 tables, and both the temporary database and archive were deleted. This is a local recovery check; encrypted offsite production backups and recovery-time objectives still need deployment-specific validation.

