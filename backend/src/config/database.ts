import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: "backend/.env" });

export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});