const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');

// Backblaze B2 is S3-compatible — we point the AWS SDK at B2's endpoint
const requiredEnvVars = ['B2_ENDPOINT', 'B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET_NAME', 'B2_PUBLIC_URL'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`${key} must be set. See Backblaze B2 setup instructions in README.md`);
  }
}

// Extract the region from the endpoint itself (e.g. "s3.us-east-005.backblazeb2.com" -> "us-east-005")
// This MUST match the bucket's actual region or Backblaze rejects the request signature.
const endpointParts = process.env.B2_ENDPOINT.split('.');
const region = endpointParts.length >= 2 ? endpointParts[1] : 'us-west-004';

const s3 = new S3Client({
  region,
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true, // Backblaze B2 requires path-style requests, not virtual-hosted-style
});

const BUCKET = process.env.B2_BUCKET_NAME;
const PUBLIC_URL = process.env.B2_PUBLIC_URL.replace(/\/$/, ''); // strip trailing slash

/**
 * Upload a file buffer to Backblaze B2. Returns { key, url }.
 */
async function uploadFile(buffer, originalName, contentType) {
  const ext = originalName.includes('.') ? originalName.split('.').pop() : '';
  const key = `${randomUUID()}${ext ? '.' + ext : ''}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  }));

  return { key, url: `${PUBLIC_URL}/${key}` };
}

/**
 * Delete a file from Backblaze B2 by its key.
 */
async function deleteFile(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.warn('B2 delete failed (non-fatal):', err.message);
  }
}

module.exports = { uploadFile, deleteFile };
