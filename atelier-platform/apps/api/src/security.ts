import { createHash, randomBytes } from "node:crypto";
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const permissionKeys = [
  "customers.read",
  "customers.write",
  "employees.read",
  "employees.write",
  "services.read",
  "services.write",
  "appointments.read",
  "appointments.write",
  "settings.manage",
  "roles.manage",
  "features.manage",
  "audit.read",
  "inventory.read",
  "inventory.write",
  "finance.read",
  "finance.write",
  "payroll.read",
  "payroll.write",
  "marketing.read",
  "marketing.write",
  "forms.read",
  "forms.write",
  "reviews.read",
  "reviews.write",
  "ugc.read",
  "ugc.write",
] as const;
export function featureAllowed(
  feature: {
    enabled: boolean;
    allowed_plans: string[];
    dependency: string | null;
  },
  tenantEnabled: boolean,
  plan: string,
  dependencyEnabled = true,
) {
  return (
    feature.enabled &&
    tenantEnabled &&
    feature.allowed_plans.includes(plan) &&
    (!feature.dependency || dependencyEnabled)
  );
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
