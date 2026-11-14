import {build} from "esbuild";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import path from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const resolve=createRequire(new URL("../package.json",import.meta.url)).resolve;
await build({
  absWorkingDir:root,entryPoints:["src/cloudflare.ts"],outfile:"dist-cloudflare/worker.mjs",
  bundle:true,platform:"node",format:"esm",target:"es2022",conditions:["workerd","node"],minify:true,
  external:["cloudflare:*","node:*","pg-native"],
  define:{"process.env.NODE_ENV":'"production"',"process.env.CLOUDFLARE_WORKER":'"1"'},
  alias:{
    pdfkit:fileURLToPath(new URL("../src/pdfkit.workers.mjs",import.meta.url)),
    "etalier-font-regular":resolve("pdfkit/standard-fonts/Helvetica"),
    "etalier-font-bold":resolve("pdfkit/standard-fonts/HelveticaBold"),
    "etalier-pdfkit-browser":path.join(path.dirname(resolve("pdfkit")),"pdfkit.browser.mjs"),
    "swagger-ui-express":fileURLToPath(new URL("../src/swagger.workers.ts",import.meta.url)),
    "dotenv/config":fileURLToPath(new URL("./worker-env.mjs",import.meta.url))
  },
  plugins:[{name:"worker-compatibility",setup(builder){
    builder.onResolve({filter:/logger\.js$/},args=>args.importer.startsWith(path.join(root,"src"))?{path:fileURLToPath(new URL("../src/logger.workers.ts",import.meta.url))}:undefined);
    // PDFKit registers this virtual file internally; no network or filesystem access is needed.
    builder.onLoad({filter:/pdfkit\.browser\.mjs$/},async args=>({contents:(await readFile(args.path,"utf8")).replaceAll("import.meta.url",'"file:///pdfkit/pdfkit.browser.mjs"'),loader:"js",resolveDir:path.dirname(args.path)}));
  }}],
  banner:{js:'import {createRequire} from "node:module";const require=createRequire("/");'}
});
