// lib/r2.js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let s3;
export function getS3() {
  if (!s3) {
    s3 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT, // 如 https://<accountid>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3;
}

export async function putObject({ bucket, key, body, contentType }) {
  const client = getS3();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  const base = process.env.R2_PUBLIC_BASE; // 如 https://pub-xxxx.r2.dev 或 https://cdn.example.com
  return `${base.replace(/\/$/, '')}/${encodeURI(key)}`;
}
