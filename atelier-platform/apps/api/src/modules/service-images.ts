import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { serviceIcons, validServiceImage } from "../services/service-image.js";

export function register(app: express.Express) {
  app.put(
    "/api/v1/services/:id/image",
    (req, res, next) => express.raw({
      type: ["image/jpeg", "image/png", "image/webp"],
      limit: "2mb",
    })(req, res, (error) => next(error ? new HttpError(error.status === 413 ? 413 : 422, "Choose a JPG, PNG or WebP image up to 2 MB.") : undefined)),
    wrap(async (req, res) => {
      const session = await tenantContext(req, "services.write");
      await feature(session.tenant_id, "services", session.plan);
      const id = z.string().uuid().parse(req.params.id);
      const type = req.get("Content-Type")?.split(";")[0] || "";
      if (!Buffer.isBuffer(req.body) || !validServiceImage(req.body, type))
        throw new HttpError(422, "Choose a JPG, PNG or WebP image up to 2 MB.");
      const version = randomUUID();
      await scoped(session.tenant_id, async (c) => {
        const result = await c.query(
          "UPDATE services SET image_version=$3 WHERE tenant_id=$1 AND id=$2 RETURNING id",
          [session.tenant_id, id, version],
        );
        if (!result.rowCount) throw new HttpError(404, "Service not found");
        await c.query(
          "INSERT INTO service_images(tenant_id,service_id,content_type,data) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,service_id) DO UPDATE SET content_type=EXCLUDED.content_type,data=EXCLUDED.data",
          [session.tenant_id, id, type, req.body],
        );
        await audit(
          c,
          session.user_id,
          session.tenant_id,
          "service.image.updated",
          id,
        );
      });
      ok(res, { image_version: version });
    }),
  );
  app.patch(
    "/api/v1/services/:id/visual",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "services.write");
      await feature(session.tenant_id, "services", session.plan);
      const id = z.string().uuid().parse(req.params.id);
      const { icon_key } = z
        .object({ icon_key: z.enum(serviceIcons) })
        .strict()
        .parse(req.body);
      await scoped(session.tenant_id, async (c) => {
        const result = await c.query(
          "UPDATE services SET icon_key=$3,image_version=NULL WHERE tenant_id=$1 AND id=$2 RETURNING id",
          [session.tenant_id, id, icon_key],
        );
        if (!result.rowCount) throw new HttpError(404, "Service not found");
        await c.query(
          "DELETE FROM service_images WHERE tenant_id=$1 AND service_id=$2",
          [session.tenant_id, id],
        );
        await audit(
          c,
          session.user_id,
          session.tenant_id,
          "service.icon.updated",
          id,
        );
      });
      ok(res, { icon_key, image_version: null });
    }),
  );
  app.get(
    "/api/v1/services/:id/image",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "services.read");
      await feature(session.tenant_id, "services", session.plan);
      const id = z.string().uuid().parse(req.params.id);
      const image = await scoped(
        session.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT i.content_type,i.data FROM service_images i JOIN services s ON s.tenant_id=i.tenant_id AND s.id=i.service_id WHERE i.tenant_id=$1 AND i.service_id=$2 AND s.image_version IS NOT NULL",
              [session.tenant_id, id],
            )
          ).rows[0],
      );
      if (!image) throw new HttpError(404, "Service image not found");
      res.setHeader("Content-Type", image.content_type);
      res.setHeader("Content-Disposition", "inline");
      res.send(image.data);
    }),
  );
}
