import type express from "express";
import { invoiceEmail } from "../services/email-templates.js";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError, digest } from "../security.js";
import { sameBranch, moveStock } from "../services/inventory.js";
import { integrationStatus, sendEmail } from "../services/providers.js";
import { quickWorkSchema, quickTotals } from "../services/quick-work.js";
import { invoicePDF } from "../services/invoice-pdf.js";
import { plainText } from "../services/intake-validation.js";
const uuid = z.string().uuid();
async function context(req: express.Request, write = false) {
  const s = await tenantContext(req, write ? "finance.write" : "finance.read");
  await feature(s.tenant_id, "pos", s.plan);
  return s;
}
export function register(app: express.Express) {
  app.get(
    "/api/v1/quick-work/options",
    wrap(async (req, res) => {
      const s = await context(req);
      await feature(s.tenant_id, "services", s.plan);
      await feature(s.tenant_id, "employees", s.plan);
      await feature(s.tenant_id, "customers", s.plan);
      let emailReady = integrationStatus().resend;
      try {
        await feature(s.tenant_id, "email", s.plan);
      } catch (error) {
        if (error instanceof HttpError && error.status === 403)
          emailReady = false;
        else throw error;
      }
      ok(
        res,
        await scoped(s.tenant_id, async (c) => ({
          settings: (
            await c.query(
              "SELECT currency,timezone,tax_basis_points,payment_methods,to_char(now(),'YYYY-MM-DD') today FROM tenants WHERE id=$1",
              [s.tenant_id],
            )
          ).rows[0],
          branches: (
            await c.query(
              "SELECT id,name FROM branches WHERE tenant_id=$1 AND active AND ($2::uuid IS NULL OR id=$2) ORDER BY name",
              [s.tenant_id, s.branch_id],
            )
          ).rows,
          employees: (
            await c.query(
              "SELECT id,name,title,branch_id,image_version FROM employees WHERE tenant_id=$1 AND active AND ($2::uuid IS NULL OR branch_id=$2) ORDER BY name",
              [s.tenant_id, s.branch_id],
            )
          ).rows,
          services: (
            await c.query(
              "SELECT id,name,price_minor,duration_minutes,icon_key,image_version FROM services WHERE tenant_id=$1 AND active ORDER BY name",
              [s.tenant_id],
            )
          ).rows,
          email_ready: emailReady,
        })),
      );
    }),
  );
  app.get(
    "/api/v1/quick-work/customers",
    wrap(async (req, res) => {
      const s = await context(req);
      await tenantContext(req, "customers.read");
      const { q } = z
        .object({ q: z.string().trim().max(100).default("") })
        .parse(req.query);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT id,name,email,phone,photo_media_id FROM customers WHERE tenant_id=$1 AND deleted_at IS NULL AND NOT is_walk_in AND ($2='' OR name ILIKE '%'||$2||'%' OR COALESCE(email,'') ILIKE '%'||$2||'%' OR COALESCE(phone,'') ILIKE '%'||$2||'%' OR similarity(lower(name),lower($2))>=0.18 OR word_similarity(lower($2),lower(name))>=0.35) ORDER BY CASE WHEN $2='' THEN 0 ELSE GREATEST(similarity(lower(name),lower($2)),word_similarity(lower($2),lower(name))) END DESC,name LIMIT 30",
                [s.tenant_id, q],
              )
            ).rows,
        ),
      );
    }),
  );
  app.get(
    "/api/v1/quick-work/today",
    wrap(async (req, res) => {
      const s = await context(req);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                `SELECT v.id,v.order_id,v.created_at,to_char(v.created_at,'HH24:MI') time_label,cu.name customer_name,cu.photo_media_id,v.customer_id,e.name employee_name,b.name branch_name,v.customer_type,v.payment_method,v.receipt_status,o.total_minor,o.tip_minor,(SELECT string_agg(qs.name,', ') FROM quick_work_services qs WHERE qs.tenant_id=v.tenant_id AND qs.visit_id=v.id) services,'quick' source FROM quick_work_visits v JOIN orders o ON o.tenant_id=v.tenant_id AND o.id=v.order_id JOIN customers cu ON cu.tenant_id=v.tenant_id AND cu.id=v.customer_id JOIN employees e ON e.tenant_id=v.tenant_id AND e.id=v.employee_id JOIN branches b ON b.tenant_id=v.tenant_id AND b.id=v.branch_id WHERE v.tenant_id=$1 AND v.created_at>=date_trunc('day',now()) AND ($2::uuid IS NULL OR v.branch_id=$2) UNION ALL SELECT a.id,o.id,a.ends_at,to_char(a.ends_at,'HH24:MI'),cu.name,cu.photo_media_id,a.customer_id,e.name,b.name,'appointment',NULL,NULL,COALESCE((SELECT sum(p.amount_minor) FROM payments p WHERE p.tenant_id=a.tenant_id AND p.order_id=o.id),0),COALESCE(o.tip_minor,0),(SELECT string_agg(sv.name,', ') FROM appointment_services aps JOIN services sv ON sv.tenant_id=aps.tenant_id AND sv.id=aps.service_id WHERE aps.tenant_id=a.tenant_id AND aps.appointment_id=a.id),'appointment' FROM appointments a JOIN customers cu ON cu.tenant_id=a.tenant_id AND cu.id=a.customer_id JOIN employees e ON e.tenant_id=a.tenant_id AND e.id=a.employee_id JOIN branches b ON b.tenant_id=a.tenant_id AND b.id=a.branch_id LEFT JOIN orders o ON o.tenant_id=a.tenant_id AND o.appointment_id=a.id WHERE a.tenant_id=$1 AND a.status='completed' AND a.ends_at>=date_trunc('day',now()) AND a.ends_at<date_trunc('day',now())+interval '1 day' AND ($2::uuid IS NULL OR a.branch_id=$2) ORDER BY created_at DESC LIMIT 200`,
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/quick-work",
    wrap(async (req, res) => {
      const s = await context(req, true);
      await feature(s.tenant_id, "services", s.plan);
      await feature(s.tenant_id, "employees", s.plan);
      const d = quickWorkSchema.parse(req.body);
      let inventoryAllowed = true;
      try {
        await feature(s.tenant_id, "inventory", s.plan);
      } catch (error) {
        if (error instanceof HttpError && error.status === 403)
          inventoryAllowed = false;
        else throw error;
      }
      sameBranch(s, d.branch_id);
      await tenantContext(
        req,
        d.customer_type === "walkin" ? "customers.write" : "customers.read",
      );
      if (d.send_invoice) {
        await feature(s.tenant_id, "email", s.plan);
        if (!integrationStatus().resend)
          throw new HttpError(
            503,
            "Email is not configured. Turn off invoice email to record this visit.",
          );
      }
      const hash = digest(JSON.stringify(d));
      const result = await scoped(s.tenant_id, async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          s.tenant_id + d.request_key,
        ]);
        const prior = (
          await c.query(
            "SELECT * FROM quick_work_visits WHERE tenant_id=$1 AND request_key=$2",
            [s.tenant_id, d.request_key],
          )
        ).rows[0];
        if (prior) {
          if (prior.request_hash !== hash)
            throw new HttpError(
              409,
              "This request was already used for a different visit.",
            );
          return { visit: prior, created: false };
        }
        const settings = (
          await c.query(
            "SELECT tax_basis_points,payment_methods FROM tenants WHERE id=$1 FOR SHARE",
            [s.tenant_id],
          )
        ).rows[0];
        if (!settings.payment_methods.includes(d.payment_method))
          throw new HttpError(
            422,
            "This payment method is disabled for this salon.",
          );
        if (
          !(
            await c.query(
              "SELECT 1 FROM branches WHERE tenant_id=$1 AND id=$2 AND active",
              [s.tenant_id, d.branch_id],
            )
          ).rowCount
        )
          throw new HttpError(422, "Choose an active location.");
        const employee = (
          await c.query(
            "SELECT * FROM employees WHERE tenant_id=$1 AND id=$2 AND branch_id=$3 AND active FOR UPDATE",
            [s.tenant_id, d.employee_id, d.branch_id],
          )
        ).rows[0];
        if (!employee)
          throw new HttpError(
            422,
            "Choose an active team member at this location.",
          );
        const services = (
          await c.query(
            "SELECT id,name,price_minor FROM services WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND active FOR SHARE",
            [s.tenant_id, d.service_ids],
          )
        ).rows;
        if (services.length !== d.service_ids.length)
          throw new HttpError(
            422,
            "A selected service is no longer available.",
          );
        const items = [
          ...services.map((row) => ({
            ...row,
            price_minor: Number(row.price_minor),
          })),
          ...(d.other
            ? [
                {
                  id: null,
                  name: d.other.name,
                  price_minor: d.other.price_minor,
                },
              ]
            : []),
        ];
        let totals;
        try {
          totals = quickTotals(
            items.reduce((sum, item) => sum + item.price_minor, 0),
            d.service_paid_minor,
            settings.tax_basis_points,
            d.tip_minor,
          );
        } catch (error) {
          throw new HttpError(422, (error as Error).message);
        }
        let customer;
        if (d.customer_type === "returning")
          customer = (
            await c.query(
              "SELECT id,name,email FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
              [s.tenant_id, d.customer_id],
            )
          ).rows[0];
        else
          customer = (
            await c.query(
              "INSERT INTO customers(tenant_id,name,email,phone,is_walk_in) VALUES($1,$2,$3,$4,true) RETURNING id,name,email",
              [
                s.tenant_id,
                d.customer_name || "Walk-in customer",
                d.email || null,
                d.phone || null,
              ],
            )
          ).rows[0];
        if (!customer)
          throw new HttpError(422, "Choose an available customer.");
        if (d.send_invoice && !customer.email)
          throw new HttpError(
            422,
            "This customer needs an email address for invoice delivery.",
          );
        const order = (
          await c.query(
            "INSERT INTO orders(tenant_id,branch_id,customer_id,employee_id,subtotal_minor,discount_minor,tax_minor,tip_minor,total_minor,status,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'paid',$10) RETURNING *",
            [
              s.tenant_id,
              d.branch_id,
              customer.id,
              employee.id,
              totals.subtotal_minor,
              totals.discount_minor,
              totals.tax_minor,
              totals.tip_minor,
              totals.total_minor,
              "quick:" + d.request_key,
            ],
          )
        ).rows[0];
        const visit = (
          await c.query(
            "INSERT INTO quick_work_visits(tenant_id,branch_id,customer_id,employee_id,order_id,customer_type,payment_method,receipt_status,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
            [
              s.tenant_id,
              d.branch_id,
              customer.id,
              employee.id,
              order.id,
              d.customer_type,
              d.payment_method,
              d.send_invoice ? "pending" : "none",
              d.request_key,
              hash,
            ],
          )
        ).rows[0];
        for (const item of items) {
          await c.query(
            "INSERT INTO order_items(tenant_id,order_id,service_id,name,quantity,price_minor,custom) VALUES($1,$2,$3,$4,1,$5,$6)",
            [
              s.tenant_id,
              order.id,
              item.id,
              item.name,
              item.price_minor,
              !item.id,
            ],
          );
          await c.query(
            "INSERT INTO quick_work_services(tenant_id,visit_id,service_id,name,price_minor) VALUES($1,$2,$3,$4,$5)",
            [s.tenant_id, visit.id, item.id, item.name, item.price_minor],
          );
        }
        if (totals.total_minor > 0)
          await c.query(
            "INSERT INTO payments(tenant_id,order_id,amount_minor,method,idempotency_key) VALUES($1,$2,$3,$4,$5)",
            [
              s.tenant_id,
              order.id,
              totals.total_minor,
              d.payment_method,
              "quick:" + d.request_key,
            ],
          );
        const consumables = (
          await c.query(
            "SELECT product_id,sum(quantity) quantity FROM service_consumables WHERE tenant_id=$1 AND service_id=ANY($2::uuid[]) GROUP BY product_id ORDER BY product_id",
            [s.tenant_id, d.service_ids],
          )
        ).rows;
        for (const product of inventoryAllowed ? consumables : [])
          await moveStock(
            c,
            s.tenant_id,
            d.branch_id,
            product.product_id,
            -Number(product.quantity),
            "service_consumption",
            s.user_id,
            visit.id,
          );
        await c.query(
          "INSERT INTO commissions(tenant_id,employee_id,quick_visit_id,amount_minor) VALUES($1,$2,$3,$4)",
          [
            s.tenant_id,
            employee.id,
            visit.id,
            Math.round(
              (d.service_paid_minor * employee.commission_basis_points) / 10000,
            ),
          ],
        );
        await audit(
          c,
          s.user_id,
          s.tenant_id,
          "quick_work.completed",
          visit.id,
        );
        return { visit, created: true };
      });
      let receipt_status = result.visit.receipt_status;
      if (result.created && d.send_invoice)
        receipt_status = await sendReceipt(s.tenant_id, result.visit.id);
      ok(res, { ...result.visit, receipt_status }, result.created ? 201 : 200);
    }),
  );
  async function invoice(tenant: string, orderId: string) {
    return scoped(tenant, async (c) => {
      const order = (
        await c.query(
          "SELECT o.*,cu.name customer_name,cu.email customer_email,cu.phone customer_phone,cu.is_walk_in,b.name branch_name,b.address branch_address,t.name salon_name,t.contact_email salon_email,t.phone salon_phone,t.address salon_address,t.currency,t.timezone,COALESCE(e.name,ae.name) employee_name FROM orders o JOIN customers cu ON cu.tenant_id=o.tenant_id AND cu.id=o.customer_id JOIN branches b ON b.tenant_id=o.tenant_id AND b.id=o.branch_id JOIN tenants t ON t.id=o.tenant_id LEFT JOIN employees e ON e.tenant_id=o.tenant_id AND e.id=o.employee_id LEFT JOIN appointments a ON a.tenant_id=o.tenant_id AND a.id=o.appointment_id LEFT JOIN employees ae ON ae.tenant_id=a.tenant_id AND ae.id=a.employee_id WHERE o.tenant_id=$1 AND o.id=$2",
          [tenant, orderId],
        )
      ).rows[0];
      if (!order) throw new HttpError(404, "Invoice not found");
      const items = (
        await c.query(
          "SELECT name,quantity,price_minor FROM order_items WHERE tenant_id=$1 AND order_id=$2 ORDER BY id",
          [tenant, orderId],
        )
      ).rows;
      const payments = (
        await c.query(
          "SELECT amount_minor,method,created_at FROM payments WHERE tenant_id=$1 AND order_id=$2 ORDER BY created_at",
          [tenant, orderId],
        )
      ).rows;
      const refunds = (
        await c.query(
          "SELECT r.id,r.amount_minor,r.reason,r.created_at FROM refunds r JOIN payments p ON p.id=r.payment_id AND p.tenant_id=r.tenant_id WHERE p.tenant_id=$1 AND p.order_id=$2 ORDER BY r.created_at",
          [tenant, orderId],
        )
      ).rows;
      const paid = payments.reduce(
          (sum, payment) => sum + Number(payment.amount_minor),
          0,
        ),
        refunded = refunds.reduce(
          (sum, refund) => sum + Number(refund.amount_minor),
          0,
        );
      const status =
        order.status === "void"
          ? "void"
          : refunded > 0
            ? refunded >= paid
              ? "refunded"
              : "partially_refunded"
            : paid >= Number(order.total_minor)
              ? "paid"
              : paid > 0
                ? "partially_paid"
                : "unpaid";
      const labels: Record<string, string> = {
        void: "Voided",
        refunded: "Fully refunded",
        partially_refunded: "Partially refunded",
        paid: "Paid",
        partially_paid: "Partially paid",
        unpaid: "Unpaid",
      };
      return {
        order,
        items,
        payments,
        refunds,
        number: "ET-" + order.id.slice(0, 8).toUpperCase(),
        summary: {
          status,
          label: labels[status],
          paid_minor: paid,
          refunded_minor: refunded,
          net_paid_minor: paid - refunded,
          balance_minor:
            order.status === "void"
              ? 0
              : Math.max(0, Number(order.total_minor) - paid),
        },
      };
    });
  }
  async function sendReceipt(tenant: string, visitId: string) {
    const visit = await scoped(
      tenant,
      async (c) =>
        (
          await c.query(
            "SELECT order_id,receipt_status FROM quick_work_visits WHERE tenant_id=$1 AND id=$2",
            [tenant, visitId],
          )
        ).rows[0],
    );
    if (!visit) throw new HttpError(404, "Visit not found");
    if (visit.receipt_status === "sent") return "sent";
    const data = await invoice(tenant, visit.order_id),
      money = (value: number) =>
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: data.order.currency,
        }).format(Number(value) / 100);
    let status = "sent";
    try {
      await sendEmail(
        data.order.customer_email,
        `Your invoice from ${data.order.salon_name}`,
        `Hello ${data.order.customer_name},\n\nInvoice ${data.order.id}\n${data.items.map((item) => `${item.name} × ${item.quantity}: ${money(item.price_minor * item.quantity)}`).join("\n")}\nDiscount: ${money(data.order.discount_minor)}\nTax: ${money(data.order.tax_minor)}\nTip: ${money(data.order.tip_minor)}\nTotal received: ${money(data.order.total_minor)}\nTeam member: ${data.order.employee_name || "—"}\n\nThank you.`,
        visitId,
        {
          content: invoiceEmail(data),
          ...(data.order.salon_email
            ? { replyTo: data.order.salon_email }
            : {}),
        },
      );
    } catch {
      status = "failed";
    }
    await scoped(tenant, async (c) => {
      await c.query(
        "UPDATE quick_work_visits SET receipt_status=$3 WHERE tenant_id=$1 AND id=$2",
        [tenant, visitId, status],
      );
    });
    return status;
  }
  app.get(
    "/api/v1/quick-work/invoices/:id",
    wrap(async (req, res) => {
      const s = await context(req),
        data = await invoice(s.tenant_id, uuid.parse(req.params.id));
      sameBranch(s, data.order.branch_id);
      let email_ready = integrationStatus().resend;
      try {
        await feature(s.tenant_id, "email", s.plan);
      } catch (error) {
        if (error instanceof HttpError && error.status === 403)
          email_ready = false;
        else throw error;
      }
      ok(res, { ...data, email_ready });
    }),
  );
  app.get(
    "/api/v1/quick-work/invoices/:id/pdf",
    wrap(async (req, res) => {
      const s = await context(req),
        data = await invoice(s.tenant_id, uuid.parse(req.params.id));
      sameBranch(s, data.order.branch_id);
      const bytes = await invoicePDF(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Etalier-invoice-${data.number}.pdf"`,
      );
      res.send(bytes);
    }),
  );
  app.post(
    "/api/v1/quick-work/invoices/:id/customer",
    wrap(async (req, res) => {
      const s = await context(req, true);
      await tenantContext(req, "customers.write");
      const id = uuid.parse(req.params.id);
      const d = z
        .object({
          name: z
            .string()
            .max(120)
            .transform(plainText)
            .pipe(z.string().min(2)),
          email: z.string().trim().email().max(254).optional(),
          phone: z.string().trim().max(40).optional(),
        })
        .strict()
        .parse(req.body);
      const customer = await scoped(s.tenant_id, async (c) => {
        const row = (
          await c.query(
            "SELECT cu.id,cu.is_walk_in,o.branch_id FROM orders o JOIN customers cu ON cu.id=o.customer_id AND cu.tenant_id=o.tenant_id WHERE o.tenant_id=$1 AND o.id=$2 AND cu.deleted_at IS NULL FOR UPDATE OF cu",
            [s.tenant_id, id],
          )
        ).rows[0];
        if (!row) throw new HttpError(404, "Invoice customer not found");
        sameBranch(s, row.branch_id);
        if (!row.is_walk_in) return { id: row.id, already_saved: true };
        await c.query(
          "UPDATE customers SET name=$3,email=$4,phone=$5,is_walk_in=false,updated_at=now() WHERE tenant_id=$1 AND id=$2",
          [s.tenant_id, row.id, d.name, d.email || null, d.phone || null],
        );
        await audit(
          c,
          s.user_id,
          s.tenant_id,
          "invoice.customer.saved",
          row.id,
        );
        return { id: row.id, already_saved: false };
      });
      ok(res, customer);
    }),
  );
  app.post(
    "/api/v1/quick-work/invoices/:id/email",
    wrap(async (req, res) => {
      const s = await context(req, true);
      await feature(s.tenant_id, "email", s.plan);
      if (!integrationStatus().resend)
        throw new HttpError(503, "Receipt email is not set up yet.");
      const data = await invoice(s.tenant_id, uuid.parse(req.params.id));
      sameBranch(s, data.order.branch_id);
      if (!data.order.customer_email)
        throw new HttpError(422, "Add a customer email address first.");
      const money = (value: number) =>
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: data.order.currency,
        }).format(Number(value) / 100);
      await sendEmail(
        data.order.customer_email,
        `${data.number} · ${data.order.salon_name}`,
        `Hello ${data.order.customer_name},\n\nInvoice ${data.number}\n${data.items.map((item) => `${item.name} × ${item.quantity}: ${money(item.price_minor * item.quantity)}`).join("\n")}\nSubtotal: ${money(data.order.subtotal_minor)}\nDiscount: ${money(data.order.discount_minor)}\nTax: ${money(data.order.tax_minor)}\nTip: ${money(data.order.tip_minor)}\nInvoice total: ${money(data.order.total_minor)}\nPayments received: ${money(data.summary.paid_minor)}\nRefunded: ${money(data.summary.refunded_minor)}\nNet paid: ${money(data.summary.net_paid_minor)}\nAmount due: ${money(data.summary.balance_minor)}\nStatus: ${data.summary.label}\n\nThank you.`,
        `invoice:${data.order.id}:${data.summary.refunded_minor}`,
        {
          content: invoiceEmail(data),
          ...(data.order.salon_email
            ? { replyTo: data.order.salon_email }
            : {}),
        },
      );
      await scoped(s.tenant_id, async (c) => {
        await audit(
          c,
          s.user_id,
          s.tenant_id,
          "invoice.receipt.sent",
          data.order.id,
        );
      });
      ok(res, { sent: true });
    }),
  );
  app.post(
    "/api/v1/quick-work/:id/email",
    wrap(async (req, res) => {
      const s = await context(req, true);
      await feature(s.tenant_id, "email", s.plan);
      if (!integrationStatus().resend)
        throw new HttpError(503, "Email is not configured.");
      const id = uuid.parse(req.params.id);
      const visit = await scoped(
        s.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT v.branch_id,cu.email FROM quick_work_visits v JOIN customers cu ON cu.id=v.customer_id AND cu.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND v.id=$2",
              [s.tenant_id, id],
            )
          ).rows[0],
      );
      if (!visit) throw new HttpError(404, "Visit not found");
      sameBranch(s, visit.branch_id);
      if (!visit.email)
        throw new HttpError(422, "Customer has no email address.");
      ok(res, { receipt_status: await sendReceipt(s.tenant_id, id) });
    }),
  );
}
