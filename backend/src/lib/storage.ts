import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    // Cloudflare R2 ignores the region but requires one; "auto" is its convention.
    region: process.env.S3_REGION ?? "auto",
    endpoint,
    forcePathStyle: endpoint ? true : undefined,
    // Newer AWS SDKs add CRC checksum headers + an `x-amz-checksum-mode` query
    // param to presigned URLs, which R2 (and other S3-compatible stores) reject
    // or mishandle. Only emit checksums when an operation actually requires one.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });
}

const bucket = process.env.S3_BUCKET ?? "senqo-wa";

function s3Key(bucketName: string, key: string): string {
  return `${bucketName}/${key}`;
}

export async function storageUpload(
  bucketName: string,
  key: string,
  data: ArrayBuffer | Uint8Array | string,
  contentType?: string,
): Promise<{ error?: string }> {
  try {
    const body = typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array ? data : new Uint8Array(data);
    await client().send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key(bucketName, key),
      Body: body,
      ContentType: contentType,
    }));
    return {};
  } catch (err) {
    console.error(`[storage/upload] Error: ${String(err)}`);
    return { error: String(err) };
  }
}

export async function storageDownload(
  bucketName: string,
  key: string,
): Promise<Uint8Array | null> {
  try {
    const res = await client().send(new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key(bucketName, key),
    }));
    if (!res.Body) return null;
    const buf = await res.Body.transformToByteArray();
    if (!buf || buf.length === 0) {
      return null;
    }
    return buf;
  } catch (err) {
    console.error(`[storage/download] Error: ${String(err)}`);
    return null;
  }
}

export async function storageRemove(
  bucketName: string,
  keys: string[],
): Promise<{ error?: string }> {
  if (keys.length === 0) return {};
  try {
    await client().send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.map((k) => ({ Key: s3Key(bucketName, k) })) },
    }));
    return {};
  } catch (err) {
    console.error(`[storage/remove] Error: ${String(err)}`);
    return { error: String(err) };
  }
}

export async function storageCreateSignedUrl(
  bucketName: string,
  key: string,
  ttlSeconds: number,
): Promise<string | null> {
  try {
    return await getSignedUrl(client(), new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key(bucketName, key),
    }), { expiresIn: ttlSeconds });
  } catch (err) {
    console.error(`[storage/signedUrl] Error: ${String(err)}`);
    return null;
  }
}