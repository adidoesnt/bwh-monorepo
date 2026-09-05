import { env } from "$env/dynamic/private";

// Dev fallbacks target the docker-compose services so a bare checkout runs
// with no .env. Production sets these explicitly (see .env.example).
export const DATABASE_URL =
  env.DATABASE_URL || "postgresql://bwh:bwh@localhost:5432/bwh";

export const AUTH_BASE_URL = env.AUTH_BASE_URL || "http://localhost:4322/";

// Object storage — defaults target the floci container; prod points at real S3.
export const s3 = {
  endpoint: env.S3_ENDPOINT || "http://localhost:4566",
  region: env.S3_REGION || "us-east-1",
  bucket: env.S3_BUCKET || "bwh-uploads",
  accessKeyId: env.S3_ACCESS_KEY_ID || "test",
  secretAccessKey: env.S3_SECRET_ACCESS_KEY || "test",
  forcePathStyle: (env.S3_FORCE_PATH_STYLE || "true") === "true",
  autoCreateBucket: (env.S3_AUTO_CREATE_BUCKET || "true") === "true",
};

export const ENABLE_STRIPE_PAYMENTS = env.ENABLE_STRIPE_PAYMENTS === "true";
