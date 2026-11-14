import { httpServerHandler } from "cloudflare:node";
import { app } from "./app.js";
import { withDatabase } from "./db.js";
import { processLeadNotifications } from "./services/contact-leads.js";
import { processPayrolls } from "./services/payroll.js";
app.listen(4000);
const server=httpServerHandler({port:4000});
type IncomingRequest=Parameters<NonNullable<typeof server.fetch>>[0];
export default {
  async fetch(request:IncomingRequest,env:Cloudflare.Env,ctx:ExecutionContext){
    if(!env.HYPERDRIVE?.connectionString)return Response.json({error:{message:"Database connection is not configured."}},{status:503});
    const headers=new Headers(request.headers);
    const internal=new URL(request.url).hostname === "etalier-api.internal";
    headers.set("x-etalier-client-ip",(internal?request.headers.get("x-etalier-client-ip"):null)||request.headers.get("cf-connecting-ip")||"0.0.0.0");
    // Cloning an incoming Workers request preserves its Cloudflare metadata.
    const forwarded=new Request(request,{headers}) as IncomingRequest;
    return withDatabase(env.HYPERDRIVE.connectionString,async()=>server.fetch!(forwarded,env,ctx));
  },
  async scheduled(_event:ScheduledController,env:Cloudflare.Env,ctx:ExecutionContext){
    if(!env.HYPERDRIVE?.connectionString)return;
    ctx.waitUntil(withDatabase(env.HYPERDRIVE.connectionString,async()=>{await processLeadNotifications();await processPayrolls();}));
  }
} satisfies ExportedHandler<Cloudflare.Env>;
