
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./config/database.js";
import materialsRouter from "./routes/materials.js";
import lotsRouter from "./routes/lots.js";
import movementsRouter from "./routes/movements.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import { requireRole } from "./middleware/auth.js";

dotenv.config({ path: "backend/.env" });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is not configured");
}

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
     "https://lab-inventory-eta-snowy.vercel.app",
    "https://lab-inventory-2-0.vercel.app"
  ],
  credentials: true,
}));

app.use(express.json());

const PgSession = connectPgSimple(session);

app.use(
  session({
    name: "labinventory.sid",
    store: new PgSession({
      pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.use("/api/materials", materialsRouter);
app.use("/api/lots", lotsRouter);
app.use("/api/movements", movementsRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);

// API health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "LabInventory API is running",
    timestamp: new Date().toISOString(),
  });
});










// GET /api/audit-trail
app.get("/api/audit-trail", requireRole("Admin"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        event_datetime AS "eventDate",
        username,
        action,
        entity_type AS "entityType",
        record_id AS "recordId",
        field_name AS "fieldName",
        old_value AS "oldValue",
        new_value AS "newValue",
        details
      FROM audit_trail
      ORDER BY event_datetime DESC, id DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get audit trail error:", error);
    res.status(500).json({
      message: "Failed to retrieve audit trail",
    });
  }
});

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    name: "LabInventory API",
    version: "1.0.0",
  });
});

app.listen(PORT, () => {
  console.log(`LabInventory API running at http://localhost:${PORT}`);
});
