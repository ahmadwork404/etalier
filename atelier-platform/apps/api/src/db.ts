import "dotenv/config";
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
const requestPools = new AsyncLocalStorage<pg.Pool>();
const nodePool = new pg.Pool({
  ...(process.env.DATABASE_URL ? {connectionString:process.env.DATABASE_URL} : {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DATABASE_NAME || "atelier",
  }),
  max: 10,
  connectionTimeoutMillis: 5000,
});
export const pool=new Proxy(nodePool,{get(target,property){const active=requestPools.getStore()||target;const value=Reflect.get(active,property);return typeof value==="function"?value.bind(active):value;}});
export async function withDatabase<T>(connectionString:string,work:()=>Promise<T>){const requestPool=new pg.Pool({connectionString,max:4,connectionTimeoutMillis:10000,idleTimeoutMillis:1000});try{return await requestPools.run(requestPool,work);}finally{await requestPool.end();}}
export const db = drizzle(pool);
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function scoped<T>(
  tenant: string,
  fn: (c: pg.PoolClient) => Promise<T>,
) {
  return transaction(async (c) => {
    await c.query("SELECT set_config('app.tenant_id',$1,true)", [tenant]);
    await c.query(
      "SELECT set_config('TimeZone',timezone,true) FROM tenants WHERE id=$1",
      [tenant],
    );
    return fn(c);
  });
}
export async function audit(
  c: pg.PoolClient,
  actor: string,
  tenant: string | null,
  action: string,
  target?: string,
) {
  await c.query(
    "INSERT INTO audit_logs(actor_id,tenant_id,action,target_id) VALUES($1,$2,$3,$4)",
    [actor, tenant, action, target || null],
  );
}
