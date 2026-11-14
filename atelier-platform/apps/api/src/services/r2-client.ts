import { AwsClient } from "aws4fetch";
import { HttpError } from "../security.js";
type Input={Bucket?:string;Key:string;Body?:Uint8Array;ContentType?:string;ContentLength?:number;Range?:string;ResponseContentDisposition?:string};
export class GetObjectCommand {method="GET";constructor(public input:Input){}}
export class PutObjectCommand {method="PUT";constructor(public input:Input){}}
export class HeadObjectCommand {method="HEAD";constructor(public input:Input){}}
export class DeleteObjectCommand {method="DELETE";constructor(public input:Input){}}
type Command=GetObjectCommand|PutObjectCommand|HeadObjectCommand|DeleteObjectCommand;
export class S3Client {
  private client:AwsClient;
  constructor(private options:{region:string;endpoint?:string;credentials:{accessKeyId:string;secretAccessKey:string}}){this.client=new AwsClient({...options.credentials,region:options.region,service:"s3",retries:2});}
  private url(command:Command){const i=command.input;if(!this.options.endpoint||!i.Bucket)throw new HttpError(503,"Cloudflare R2 is not configured");const url=new URL(this.options.endpoint);url.pathname="/"+[i.Bucket,...i.Key.split("/")].map(encodeURIComponent).join("/");if(i.ResponseContentDisposition)url.searchParams.set("response-content-disposition",i.ResponseContentDisposition);return url;}
  private headers(command:Command){const headers=new Headers();const i=command.input;if(i.ContentType)headers.set("Content-Type",i.ContentType);if(i.ContentLength!==undefined)headers.set("Content-Length",String(i.ContentLength));if(i.Range)headers.set("Range",i.Range);return headers;}
  async presign(command:Command,expires:number){const url=this.url(command);url.searchParams.set("X-Amz-Expires",String(expires));return (await this.client.sign(url,{method:command.method,headers:this.headers(command),aws:{signQuery:true,allHeaders:true}})).url;}
  async send(command:Command){const response=await this.client.fetch(this.url(command),{method:command.method,headers:this.headers(command),...(command.input.Body?{body:new Uint8Array(command.input.Body)}:{}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new HttpError(response.status===404?404:502,response.status===404?"Stored file not found":"Cloudflare R2 request failed");return {ContentType:response.headers.get("content-type")||undefined,ContentLength:Number(response.headers.get("content-length")||0),Body:{transformToByteArray:async()=>new Uint8Array(await response.arrayBuffer())}};}
}
export const getSignedUrl=(client:S3Client,command:Command,options:{expiresIn:number})=>client.presign(command,options.expiresIn);
