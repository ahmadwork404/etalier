import {defineConfig,bindings} from "cf/config";
import {accountId,compatibilityDate,apiName,observability,siteUrl} from "../cloudflare/settings.mjs";
export default defineConfig({accountId,worker:{name:"etalier-landing",entrypoint:"vinext/server/fetch-handler",domains:[{hostname:"etalier.app",production:true,previews:false}],workersDev:true,compatibilityDate,compatibilityFlags:["nodejs_compat"],observability,env:{ASSETS:bindings.assets(),SITE_ORIGIN:bindings.text(siteUrl),API:bindings.worker({worker:apiName}),NODE_ENV:bindings.text("production"),CLOUDFLARE_WORKER:bindings.text("1")}}});
