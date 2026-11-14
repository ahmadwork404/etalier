import express from "express";
import { randomUUID } from "node:crypto";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { storage } from "../services/storage.js";
import { validServiceImage } from "../services/service-image.js";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext } from "../runtime.js";
import { HttpError } from "../security.js";
import { sameBranch } from "../services/inventory.js";

export function register(app: express.Express) {
  app.put(
    "/api/v1/location-profiles/:id/photo",
    (req, res, next) =>
      express.raw({
        type: ["image/png", "image/jpeg", "image/webp"],
        limit: "2mb",
      })(req, res, (error) =>
        next(
          error
            ? new HttpError(
                error.status === 413 ? 413 : 422,
                "Choose a JPG, PNG or WebP image up to 2 MB.",
              )
            : undefined,
        ),
      ),
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage"),
        id = z.string().uuid().parse(req.params.id),
        type = req.get("Content-Type")?.split(";")[0] || "";
      if (s.branch_id)
        throw new HttpError(403, "Organization-wide access required");
      if (!Buffer.isBuffer(req.body) || !validServiceImage(req.body, type))
        throw new HttpError(422, "Choose a JPG, PNG or WebP image up to 2 MB.");
      const client = storage(),
        version = randomUUID(),
        key = `${s.tenant_id}/locations/${id}/${version}`,
        Bucket = process.env.R2_BUCKET;
      let uploaded = false,
        previous: string | null = null;
      try {
        await scoped(s.tenant_id, async (c) => {
          const location = (
            await c.query(
              "SELECT image_key FROM branches WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!location) throw new HttpError(404, "Location not found");
          previous = location.image_key;
          await client.send(
            new PutObjectCommand({
              Bucket,
              Key: key,
              Body: req.body,
              ContentType: type,
            }),
          );
          uploaded = true;
          await c.query(
            "UPDATE branches SET image_key=$3,image_version=$4 WHERE tenant_id=$1 AND id=$2",
            [s.tenant_id, id, key, version],
          );
          await audit(c, s.user_id, s.tenant_id, "location.photo.updated", id);
        });
      } catch (error) {
        if (uploaded)
          await client
            .send(new DeleteObjectCommand({ Bucket, Key: key }))
            .catch(() => {});
        throw error;
      }
      if (previous)
        await client
          .send(new DeleteObjectCommand({ Bucket, Key: previous }))
          .catch(() => {});
      ok(res, { image_version: version });
    }),
  );
  app.get(
    "/api/v1/location-profiles/:id/photo",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage"),
        id = z.string().uuid().parse(req.params.id);
      const location = await scoped(
        s.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT image_key FROM branches WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id],
            )
          ).rows[0],
      );
      if (!location?.image_key)
        throw new HttpError(404, "Location photo not found");
      sameBranch(s, id);
      const object = await storage().send(
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: location.image_key,
        }),
      );
      res.setHeader("Content-Type", object.ContentType || "image/jpeg");
      res.setHeader("Content-Disposition", "inline");
      res.send(Buffer.from(await object.Body!.transformToByteArray()));
    }),
  );
  app.delete(
    "/api/v1/location-profiles/:id/photo",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage"),
        id = z.string().uuid().parse(req.params.id);
      if (s.branch_id)
        throw new HttpError(403, "Organization-wide access required");
      const previous = await scoped(s.tenant_id, async (c) => {
        const row = (
          await c.query(
            "SELECT image_key FROM branches WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [s.tenant_id, id],
          )
        ).rows[0];
        if (!row) throw new HttpError(404, "Location not found");
        await c.query(
          "UPDATE branches SET image_key=NULL,image_version=NULL WHERE tenant_id=$1 AND id=$2",
          [s.tenant_id, id],
        );
        await audit(c, s.user_id, s.tenant_id, "location.photo.removed", id);
        return row.image_key;
      });
      if (previous)
        await storage().send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: previous,
          }),
        );
      ok(res, { removed: true });
    }),
  );
  app.get(
    "/api/v1/location-profiles",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage");
      let finance = false,
        team = false,
        bookings = false;
      for (const p of ["finance.read", "employees.read", "appointments.read"])
        try {
          await tenantContext(req, p);
          if (p === "finance.read") finance = true;
          else if (p === "employees.read") team = true;
          else bookings = true;
        } catch (e) {
          if (!(e instanceof HttpError && e.status === 403)) throw e;
        }
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                `SELECT b.id,b.name,b.address,b.active,b.image_version,
      ${team ? "(SELECT count(*)::int FROM employees e WHERE e.tenant_id=b.tenant_id AND e.branch_id=b.id AND e.active)" : "NULL::int"} employee_count,
      ${bookings ? "((SELECT count(*) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.starts_at>=date_trunc('month',now()) AND a.starts_at<date_trunc('month',now())+interval '1 month')+(SELECT count(*) FROM quick_work_visits v WHERE v.tenant_id=b.tenant_id AND v.branch_id=b.id AND v.created_at>=date_trunc('month',now()) AND v.created_at<date_trunc('month',now())+interval '1 month'))::int" : "NULL::int"} visits_month,
      ${finance ? "(SELECT COALESCE(sum(l.amount),0) FROM (SELECT p.order_id,p.created_at,p.amount_minor amount FROM payments p WHERE p.tenant_id=$1 UNION ALL SELECT p.order_id,r.created_at,-r.amount_minor FROM refunds r JOIN payments p ON p.tenant_id=r.tenant_id AND p.id=r.payment_id WHERE r.tenant_id=$1) l JOIN orders o ON o.tenant_id=b.tenant_id AND o.id=l.order_id WHERE o.branch_id=b.id AND o.status<>'void' AND l.created_at>=date_trunc('month',now()) AND l.created_at<date_trunc('month',now())+interval '1 month')" : "NULL::bigint"} net_minor
      FROM branches b WHERE b.tenant_id=$1 AND ($2::uuid IS NULL OR b.id=$2) ORDER BY b.name`,
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );

  app.get(
    "/api/v1/location-profiles/:id",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "settings.manage");
      const id = z.string().uuid().parse(req.params.id);
      const month = z
        .string()
        .regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/)
        .optional()
        .parse(req.query.month);
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .default(1)
        .parse(req.query.page);
      let finance = false,
        team = false,
        bookings = false;
      for (const permission of [
        "finance.read",
        "employees.read",
        "appointments.read",
      ]) {
        try {
          await tenantContext(req, permission);
          if (permission === "finance.read") finance = true;
          else if (permission === "employees.read") team = true;
          else bookings = true;
        } catch (error) {
          if (!(error instanceof HttpError && error.status === 403))
            throw error;
        }
      }
      ok(
        res,
        await scoped(session.tenant_id, async (c) => {
          const location = (
            await c.query(
              "SELECT b.*,t.timezone,to_char(now(),'YYYY-MM') current_month FROM branches b JOIN tenants t ON t.id=b.tenant_id WHERE b.tenant_id=$1 AND b.id=$2",
              [session.tenant_id, id],
            )
          ).rows[0];
          if (!location) throw new HttpError(404, "Location not found");
          sameBranch(session, id);
          const selectedMonth = month || location.current_month;
          const args = [session.tenant_id, id, selectedMonth + "-01"];
          const visits = `WITH visits AS (
        SELECT a.id,a.starts_at occurred_at,a.status,a.customer_id,a.employee_id,'booking' kind,NULL::uuid order_id,COALESCE((SELECT string_agg(s.name,', ') FROM appointment_services aps JOIN services s ON s.tenant_id=aps.tenant_id AND s.id=aps.service_id WHERE aps.tenant_id=a.tenant_id AND aps.appointment_id=a.id),'Appointment') services
        FROM appointments a WHERE a.tenant_id=$1 AND a.branch_id=$2
        UNION ALL SELECT v.id,v.created_at,'completed',v.customer_id,v.employee_id,'walkin',v.order_id,COALESCE((SELECT string_agg(qs.name,', ') FROM quick_work_services qs WHERE qs.tenant_id=v.tenant_id AND qs.visit_id=v.id),'Quick visit') FROM quick_work_visits v WHERE v.tenant_id=$1 AND v.branch_id=$2
      ), selected AS (SELECT * FROM visits WHERE occurred_at >= $3::date AND occurred_at < $3::date+interval '1 month')`;
          const summary = bookings
            ? (
                await c.query(
                  visits +
                    ` SELECT count(*)::int visits,count(*) FILTER(WHERE status='completed')::int completed,count(*) FILTER(WHERE status='cancelled')::int cancelled,count(*) FILTER(WHERE status='no_show')::int no_show,count(*) FILTER(WHERE status IN ('pending','confirmed','checked_in','in_progress') AND occurred_at >= now())::int upcoming,count(DISTINCT customer_id)::int customers FROM selected`,
                  args,
                )
              ).rows[0]
            : null;
          const appointments = bookings
            ? (
                await c.query(
                  visits +
                    ` SELECT v.*,to_char(v.occurred_at,'YYYY-MM-DD HH24:MI') occurred_local,cu.name customer_name,e.name employee_name FROM selected v JOIN customers cu ON cu.tenant_id=$1 AND cu.id=v.customer_id JOIN employees e ON e.tenant_id=$1 AND e.id=v.employee_id ORDER BY v.occurred_at DESC,v.id LIMIT 25 OFFSET $4`,
                  [...args, (page - 1) * 25],
                )
              ).rows
            : [];
          const ledger = `WITH ledger AS (
        SELECT p.order_id,p.created_at,p.amount_minor amount FROM payments p WHERE p.tenant_id=$1
        UNION ALL SELECT p.order_id,r.created_at,-r.amount_minor FROM refunds r JOIN payments p ON p.tenant_id=r.tenant_id AND p.id=r.payment_id WHERE r.tenant_id=$1
      ), selected AS (SELECT l.*,COALESCE(o.employee_id,a.employee_id) employee_id,o.tip_minor,o.total_minor FROM ledger l JOIN orders o ON o.tenant_id=$1 AND o.id=l.order_id LEFT JOIN appointments a ON a.tenant_id=o.tenant_id AND a.id=o.appointment_id WHERE o.branch_id=$2 AND o.status<>'void' AND l.created_at >= $3::date AND l.created_at < $3::date+interval '1 month')`;
          const financial = finance
            ? (
                await c.query(
                  ledger +
                    ` SELECT COALESCE(sum(amount) FILTER(WHERE amount>0),0) received_minor,COALESCE(-sum(amount) FILTER(WHERE amount<0),0) refunded_minor,COALESCE(sum(amount),0) net_minor,COALESCE(round(sum(amount::numeric*tip_minor/NULLIF(total_minor,0))),0) tips_minor FROM selected`,
                  args,
                )
              ).rows[0]
            : null;
          const trend = finance
            ? (
                await c.query(
                  ledger +
                    ` SELECT to_char(created_at,'YYYY-MM-DD') collection_day,COALESCE(sum(amount),0) net_minor FROM selected GROUP BY 1 ORDER BY 1`,
                  args,
                )
              ).rows
            : [];
          const employees = team
            ? (
                await c.query(
                  "SELECT id,name,title,email,phone,active,image_version FROM employees WHERE tenant_id=$1 AND branch_id=$2 ORDER BY active DESC,name",
                  args.slice(0, 2),
                )
              ).rows
            : [];
          if (team && bookings) {
            const counts = (
              await c.query(
                visits +
                  ` SELECT employee_id,count(*)::int visits,count(*) FILTER(WHERE status='completed')::int completed FROM selected GROUP BY employee_id`,
                args,
              )
            ).rows;
            for (const employee of employees)
              Object.assign(
                employee,
                counts.find((row) => row.employee_id === employee.id) || {
                  visits: 0,
                  completed: 0,
                },
              );
          }
          if (team && finance) {
            const totals = (
              await c.query(
                ledger +
                  ` SELECT employee_id,COALESCE(sum(amount),0) net_minor FROM selected GROUP BY employee_id`,
                args,
              )
            ).rows;
            for (const employee of employees)
              employee.net_minor =
                totals.find((row) => row.employee_id === employee.id)
                  ?.net_minor || 0;
          }
          return {
            location,
            month: selectedMonth,
            summary,
            financial,
            trend,
            employees,
            appointments,
            page,
            total: summary?.visits || 0,
            access: { finance, team, bookings, can_edit: !session.branch_id },
          };
        }),
      );
    }),
  );
}
