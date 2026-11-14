import { randomBytes, timingSafeEqual } from "node:crypto";
const iterations=100000;
async function derive(password:string,salt:Uint8Array){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);return Buffer.from(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-512",salt:new Uint8Array(salt),iterations},key,512));}
export async function hashPassword(password:string){const salt=randomBytes(16);return `pbkdf2-sha512$${iterations}$${salt.toString("base64url")}$${(await derive(password,salt)).toString("base64url")}`;}
export async function verifyPassword(encoded:string,password:string){
  if(encoded.startsWith("$argon2")) {
    // Native legacy verification stays available for existing local Node deployments.
    // Migrated legacy accounts can use the existing emailed password-reset flow.
    if(process.env.CLOUDFLARE_WORKER === "1")return false;
    return (await import("argon2")).verify(encoded,password);
  }
  const [algorithm,count,salt,expected,...extra]=encoded.split("$");if(algorithm!=="pbkdf2-sha512"||count!==String(iterations)||!salt||!expected||extra.length)return false;
  const stored=Buffer.from(expected,"base64url"),saltBytes=Buffer.from(salt,"base64url");if(stored.length!==64||saltBytes.length!==16)return false;
  const actual=await derive(password,saltBytes);return timingSafeEqual(stored,actual);
}
export default {hash:hashPassword,verify:verifyPassword};
