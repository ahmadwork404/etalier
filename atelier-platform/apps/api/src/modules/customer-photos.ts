import type express from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { uploadURL, verifyUpload, photoURL } from "../services/storage.js";
const uuid = z.string().uuid();
export function register(app: express.Express) {
  app.post(
    "/api/v1/customers/:id/photo/upload",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "customers.write");
      await feature(session.tenant_id, "customers", session.plan);
      const customerId = uuid.parse(req.params.id);
      const file = z
        .object({
          content_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
          size_bytes: z
            .number()
            .int()
            .positive()
            .max(5 * 1024 * 1024),
        })
        .parse(req.body);
      await scoped(session.tenant_id, async (c) => {
        if (
          !(
            await c.query(
              "SELECT 1 FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
              [session.tenant_id, customerId],
            )
          ).rowCount
        )
          throw new HttpError(404, "Customer not found");
      });
      const mediaId = randomUUID(),
        key = `${session.tenant_id}/${customerId}/profile/${mediaId}`;
      const url = await uploadURL(key, file.content_type, file.size_bytes);
      await scoped(session.tenant_id, async (c) => {
        const count = Number(
          (
            await c.query(
              "SELECT count(*) FROM media WHERE tenant_id=$1 AND customer_id=$2 AND purpose='customer_photo' AND NOT verified",
              [session.tenant_id, customerId],
            )
          ).rows[0].count,
        );
        if (count >= 10)
          throw new HttpError(
            429,
            "Too many pending photos. Finish an existing upload before trying again.",
          );
        await c.query(
          "INSERT INTO media(id,tenant_id,customer_id,object_key,content_type,size_bytes,purpose) VALUES($1,$2,$3,$4,$5,$6,'customer_photo')",
          [
            mediaId,
            session.tenant_id,
            customerId,
            key,
            file.content_type,
            file.size_bytes,
          ],
        );
      });
      ok(res, { media_id: mediaId, url, expiresInSeconds: 300 }, 201);
    }),
  );
  app.post(
    "/api/v1/customers/:id/photo/:mediaId/verify",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "customers.write");
      await feature(session.tenant_id, "customers", session.plan);
      const customerId = uuid.parse(req.params.id),
        mediaId = uuid.parse(req.params.mediaId);
      const media = await scoped(
        session.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT m.* FROM media m JOIN customers cu ON cu.id=m.customer_id AND cu.tenant_id=m.tenant_id WHERE m.tenant_id=$1 AND m.customer_id=$2 AND m.id=$3 AND m.purpose='customer_photo' AND cu.deleted_at IS NULL",
              [session.tenant_id, customerId, mediaId],
            )
          ).rows[0],
      );
      if (!media) throw new HttpError(404, "Photo upload not found");
      await verifyUpload(
        media.object_key,
        media.content_type,
        Number(media.size_bytes),
      );
      await scoped(session.tenant_id, async (c) => {
        await c.query(
          "UPDATE media SET verified=true WHERE tenant_id=$1 AND id=$2",
          [session.tenant_id, mediaId],
        );
        const result = await c.query(
          "UPDATE customers SET photo_media_id=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id",
          [session.tenant_id, customerId, mediaId],
        );
        if (!result.rowCount) throw new HttpError(404, "Customer not found");
        await audit(
          c,
          session.user_id,
          session.tenant_id,
          "customer.photo.updated",
          customerId,
        );
      });
      ok(res, { photo_media_id: mediaId });
    }),
  );
  app.get(
    "/api/v1/customers/:id/photo",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "customers.read");
      await feature(session.tenant_id, "customers", session.plan);
      const customerId = uuid.parse(req.params.id);
      const media = await scoped(
        session.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT m.object_key FROM customers cu JOIN media m ON m.id=cu.photo_media_id AND m.tenant_id=cu.tenant_id AND m.customer_id=cu.id WHERE cu.tenant_id=$1 AND cu.id=$2 AND cu.deleted_at IS NULL AND m.verified AND m.purpose='customer_photo'",
              [session.tenant_id, customerId],
            )
          ).rows[0],
      );
      if (!media) throw new HttpError(404, "Customer photo not found");
      res.redirect(await photoURL(media.object_key));
    }),
  );
}
