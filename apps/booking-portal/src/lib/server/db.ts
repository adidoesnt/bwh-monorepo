import { createDb } from "@repo/database";
import { DATABASE_URL } from "./config";

export const db = createDb(DATABASE_URL);
