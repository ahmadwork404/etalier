import { z } from "zod";
import { plainText } from "./intake-validation.js";
export const paymentMethods = [
  "cash",
  "card",
  "zelle",
  "venmo",
  "cash_app",
  "other",
  "bank_transfer",
  "stripe",
] as const;
export const quickWorkSchema = z
  .object({
    request_key: z.string().uuid(),
    customer_type: z.enum(["walkin", "returning"]),
    customer_id: z.string().uuid().optional(),
    customer_name: z.string().max(120).transform(plainText).optional(),
    email: z.string().trim().email().max(254).optional(),
    phone: z.string().trim().max(40).optional(),
    branch_id: z.string().uuid(),
    employee_id: z.string().uuid(),
    service_ids: z.array(z.string().uuid()).max(30).default([]),
    other: z
      .object({
        name: z.string().max(120).transform(plainText).pipe(z.string().min(1)),
        price_minor: z.number().int().min(0).max(100000000),
      })
      .strict()
      .optional(),
    service_paid_minor: z.number().int().min(0).max(100000000),
    tip_minor: z.number().int().min(0).max(10000000).default(0),
    payment_method: z.enum([
      "cash",
      "card",
      "zelle",
      "venmo",
      "cash_app",
      "other",
      "bank_transfer",
    ]),
    send_invoice: z.boolean().default(false),
  })
  .strict()
  .refine(
    (d) => d.customer_type !== "returning" || !!d.customer_id,
    "Choose a returning customer",
  )
  .refine(
    (d) => d.service_ids.length > 0 || !!d.other,
    "Select at least one service",
  )
  .refine(
    (d) => new Set(d.service_ids).size === d.service_ids.length,
    "Select each service once",
  );
export function quickTotals(
  subtotal: number,
  paid: number,
  taxBasisPoints: number,
  tip: number,
) {
  if (paid > subtotal)
    throw Error(
      "Service payment exceeds the listed price. Record extra money as a tip.",
    );
  const discount = subtotal - paid,
    tax = Math.round((paid * taxBasisPoints) / 10000);
  return {
    subtotal_minor: subtotal,
    discount_minor: discount,
    tax_minor: tax,
    tip_minor: tip,
    total_minor: paid + tax + tip,
  };
}
