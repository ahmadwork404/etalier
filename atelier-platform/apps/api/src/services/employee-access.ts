import type { Request } from "express";
import { tenantContext } from "../runtime.js";
import { HttpError } from "../security.js";
export async function canViewEmployeeSalary(req: Request, owner: boolean) {
  if (owner) return true;
  for (const permission of ["payroll.read", "payroll.write"]) {
    try {
      await tenantContext(req, permission);
      return true;
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 403)) throw error;
    }
  }
  return false;
}
