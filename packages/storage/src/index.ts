import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Needed for path-style S3-compatible servers (floci, MinIO); real AWS S3 doesn't want this. */
  forcePathStyle: boolean;
  /**
   * Dev convenience: create the bucket on first upload if it doesn't exist yet.
   * Leave off in prod — the bucket should be provisioned by infra there.
   */
  autoCreateBucket: boolean;
};

/** Thin S3 wrapper — works against floci (dev) and real S3 (prod) unchanged. */
export function createStorage(config: StorageConfig) {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  async function putObject(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const put = () =>
      client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );

    try {
      await put();
    } catch (err) {
      const notFound =
        err instanceof Error &&
        (err.name === "NoSuchBucket" || err.name === "NotFound");
      if (!notFound || !config.autoCreateBucket) throw err;
      await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
      await put();
    }
  }

  /** Presigned, time-limited GET — keeps the bucket private. */
  function presignedGetUrl(key: string, expiresInSec = 900): Promise<string> {
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      { expiresIn: expiresInSec },
    );
  }

  return { putObject, presignedGetUrl };
}

export type Storage = ReturnType<typeof createStorage>;
