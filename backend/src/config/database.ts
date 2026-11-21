import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: "backend/.env" });

<<<<<<< HEAD
export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);
=======
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
>>>>>>> neworigin/main

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});