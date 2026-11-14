import { z } from "zod";
export const plainText = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
const text = (max: number) => z.string().max(max).transform(plainText);
export const intakeField = z
  .object({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,50}$/)
      .refine(
        (key) => !["constructor", "prototype", "__proto__"].includes(key),
      ),
    label: text(200).pipe(z.string().min(1)),
    type: z.enum([
      "text",
      "textarea",
      "email",
      "phone",
      "number",
      "select",
      "checkbox",
      "date",
      "consent",
    ]),
    required: z.boolean().default(false),
    options: z
      .array(text(100).pipe(z.string().min(1)))
      .min(1)
      .max(30)
      .optional(),
  })
  .strict()
  .refine(
    (field) => field.type !== "select" || !!field.options?.length,
    "Choice questions need at least one option",
  )
  .refine(
    (field) =>
      !field.options || new Set(field.options).size === field.options.length,
    "Choices must be unique",
  );
export const intakeDefinition = z
  .object({
    name: text(120).pipe(z.string().min(2)),
    description: text(2000).default(""),
    fields: z
      .array(intakeField)
      .min(1)
      .max(50)
      .refine(
        (fields) =>
          new Set(fields.map((field) => field.key)).size === fields.length,
        "Question keys must be unique",
      ),
    active: z.boolean().default(true),
  })
  .strict();
export type IntakeField = z.infer<typeof intakeField>;
export function validateAnswers(
  fields: IntakeField[],
  answers: Record<string, unknown>,
) {
  if (
    Object.keys(answers).some(
      (key) => !fields.some((field) => field.key === key),
    )
  )
    throw Error("The response contains an unknown question.");
  const safe: Record<string, string | boolean> = {};
  for (const field of fields) {
    const value = answers[field.key];
    const bool = field.type === "checkbox" || field.type === "consent";
    if (value === undefined || value === "") {
      if (field.required) throw Error("Please complete " + field.label);
      continue;
    }
    if (bool) {
      if (typeof value !== "boolean" || (field.required && value !== true))
        throw Error("Please confirm " + field.label);
      safe[field.key] = value;
      continue;
    }
    if (typeof value !== "string" || value.length > 5000)
      throw Error("Invalid answer for " + field.label);
    const cleaned = plainText(value);
    if (field.required && !cleaned)
      throw Error("Please complete " + field.label);
    if (field.type === "select" && !field.options?.includes(cleaned))
      throw Error("Choose a listed option for " + field.label);
    if (
      field.type === "email" &&
      !z.string().email().safeParse(cleaned).success
    )
      throw Error("Enter a valid email for " + field.label);
    if (field.type === "phone" && !/^[+\d\s().-]{5,40}$/.test(cleaned))
      throw Error("Enter a valid phone number for " + field.label);
    if (
      field.type === "number" &&
      (!cleaned || !Number.isFinite(Number(cleaned)))
    )
      throw Error("Enter a number for " + field.label);
    if (
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) ||
        Number.isNaN(Date.parse(cleaned)) ||
        new Date(cleaned).toISOString().slice(0, 10) !== cleaned)
    )
      throw Error("Enter a valid date for " + field.label);
    safe[field.key] = cleaned;
  }
  return safe;
}
export function deviceSummary(agent: string, client: Record<string, unknown>) {
  const ua = plainText(agent).slice(0, 512);
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad/i.test(ua)
        ? "iOS"
        : /Macintosh|Mac OS/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Unknown";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Unknown";
  return {
    os,
    browser,
    type: /iPad|Tablet/i.test(ua)
      ? "Tablet"
      : /Mobile|iPhone|Android/i.test(ua)
        ? "Mobile"
        : "Desktop",
    language: plainText(String(client.language || "")).slice(0, 40),
    timezone: plainText(String(client.timezone || "")).slice(0, 80),
    screen: plainText(String(client.screen || "")).slice(0, 40),
    user_agent: ua,
  };
}
