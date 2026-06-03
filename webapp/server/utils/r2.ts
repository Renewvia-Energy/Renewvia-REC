import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let _client: S3Client | null = null

function getClient(): S3Client {
  if (_client) return _client
  const config = useRuntimeConfig()

  // If a custom upload domain is set (e.g. https://uploads.r-recs.com), use it as
  // the endpoint so presigned PUT URLs are signed for that hostname.  Cloudflare's
  // custom-domain CORS policy only fires on the custom domain, not on the raw
  // *.r2.cloudflarestorage.com S3 endpoint.
  //
  // With forcePathStyle the SDK generates:
  //   https://<R2_UPLOAD_URL>/<bucket>/<key>?X-Amz-…
  // Cloudflare receives the request on the custom domain and routes it to the
  // correct bucket via path-style, storing the object at key <key>.
  const endpoint = (config.r2UploadUrl as string | undefined)
    || `https://${config.r2AccountId as string}.r2.cloudflarestorage.com`

  _client = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: !!config.r2UploadUrl, // path-style only when using custom domain
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
    // Disable automatic checksum injection (SDK v3.600+ default is 'when_supported').
    // Presigned PUT URLs include a signed CRC32 placeholder for an empty body, which
    // causes every real file upload to fail checksum validation on R2.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  })
  return _client
}

export interface PresignedUploadResult {
  uploadUrl: string   // PUT this URL directly from the browser
  publicUrl: string   // Final publicly-accessible URL after upload
  key: string         // R2 object key
}

export { getClient as getR2Client }

/**
 * Generate a presigned GET URL. Allows authenticated users to view private R2 objects.
 */
export async function createPresignedView(key: string): Promise<string> {
  const config = useRuntimeConfig()
  const command = new GetObjectCommand({
    Bucket: config.r2BucketName,
    Key: key,
  })
  return getSignedUrl(getClient(), command, { expiresIn: 3600 }) // 1 hour
}

/**
 * Generate a presigned PUT URL. Browser uploads directly; function never touches the file.
 * Embedding userId in the key allows ownership verification without a DB lookup.
 */
export async function createPresignedUpload(
  folder: string,
  filename: string,
  contentType: string,
  userId: number,
): Promise<PresignedUploadResult> {
  const config = useRuntimeConfig()

  // Sanitize filename to avoid path traversal
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${folder}/${userId}/${Date.now()}-${safe}`

  const command = new PutObjectCommand({
    Bucket: config.r2BucketName,
    Key: key,
    ContentType: contentType,
  })

  const client = getClient()
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 }) // 5 min

  const publicUrl = `${config.public.r2PublicUrl}/${key}`

  return { uploadUrl, publicUrl, key }
}
