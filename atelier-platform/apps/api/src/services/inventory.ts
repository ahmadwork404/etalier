import type { PoolClient } from "pg";
import { HttpError } from "../security.js";
export async function moveStock(
  c: PoolClient,
  tenant: string,
  branch: string,
  product: string,
  delta: number,
  reason: string,
  actor: string,
  reference?: string,
) {
  await c.query(
    "INSERT INTO inventory_balances(tenant_id,branch_id,product_id,quantity) VALUES($1,$2,$3,0) ON CONFLICT DO NOTHING",
    [tenant, branch, product],
  );
  const r = await c.query(
    "UPDATE inventory_balances SET quantity=quantity+$4 WHERE tenant_id=$1 AND branch_id=$2 AND product_id=$3 AND quantity+$4>=0 RETURNING quantity",
    [tenant, branch, product, delta],
  );
  if (!r.rowCount)
    throw new HttpError(409, "Insufficient stock for this operation");
  await c.query(
    "INSERT INTO inventory_movements(tenant_id,branch_id,product_id,quantity,reason,actor_id,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [tenant, branch, product, delta, reason, actor, reference || null],
  );
  return r.rows[0];
}
export const sameBranch = (session: any, branch: string) => {
  if (session.branch_id && session.branch_id !== branch)
    throw new HttpError(403, "This branch is outside your access");
};
