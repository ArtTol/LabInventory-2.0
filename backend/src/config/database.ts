
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: "backend/.env" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});
