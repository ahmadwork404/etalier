import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { HttpError } from "../security.js";
import { integrationStatus } from "./providers.js";
export function storage() {
  if (!integrationStatus().r2)
    throw new HttpError(503, "Cloudflare R2 is not configured");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}
export async function uploadURL(key: string, type: string, size: number) {
  return getSignedUrl(
    storage(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: type,
      ContentLength: size,
    }),
    { expiresIn: 300 },
  );
}
export async function downloadURL(key: string) {
  return getSignedUrl(
    storage(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: "attachment",
    }),
    { expiresIn: 120 },
  );
}
export async function photoURL(key: string) {
  return getSignedUrl(
    storage(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 120 },
  );
}
export async function verifyUpload(key: string, type: string, size: number) {
  const client = storage();
  const head = await client.send(
    new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
  );
  if (head.ContentLength !== size || head.ContentType !== type) {
    await client.send(
      new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    );
    throw new HttpError(
      422,
      "Uploaded file does not match the expected type or size",
    );
  }
  const object = await client.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Range: "bytes=0-31",
    }),
  );
  const bytes = Buffer.from(await object.Body!.transformToByteArray());
  const valid =
    type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216
      : type === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : type === "image/webp"
          ? bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          : type === "video/mp4"
            ? bytes.toString("ascii", 4, 8) === "ftyp"
            : false;
  if (!valid) {
    await client.send(
      new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    );
    throw new HttpError(422, "Unsupported file contents");
  }
}
