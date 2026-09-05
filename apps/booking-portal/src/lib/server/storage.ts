import { s3 } from "./config";
import { createStorage } from "@repo/storage";

export const storage = createStorage(s3);
