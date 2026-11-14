import {defineConfig} from "vite";
import vinext from "vinext";
import {cloudflare} from "@cloudflare/vite-plugin";
export default defineConfig({define:{"process.env.CLOUDFLARE_WORKER":JSON.stringify("1")},plugins:[vinext(),cloudflare({types:{includeRuntime:false},viteEnvironment:{name:"rsc",childEnvironments:["ssr"]}})]});
