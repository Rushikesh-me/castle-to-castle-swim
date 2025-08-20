import { S3Client } from "@aws-sdk/client-s3";

const REGION = "eu-west-1";

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.APP_AWS_ACCESS_KEY!,
    secretAccessKey: process.env.APP_AWS_SECRET_KEY!,
  },
});

export { s3Client };
