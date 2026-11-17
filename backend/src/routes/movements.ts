
import { Router } from "express";
import { pool } from "../config/database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
// GET /api/movements
// GET /api/movements
router.get("/", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
  SELECT
    mv.id,
    mv.movement_datetime AS "movementDate",
    mv.movement_type AS "movementType",
    m.name AS material,
    l.lot_number AS "lotNumber",
    mv.quantity_signed AS quantity,
    m.unit,
    mv.reason,
    mv.reference,
    COALESCE(u.username, '—') AS "user"
  FROM movements mv
  JOIN lots l ON l.id = mv.lot_id
  JOIN materials m ON m.id = mv.material_id
  LEFT JOIN users u ON u.id = mv.user_id
  ORDER BY mv.movement_datetime DESC, mv.id DESC
  LIMIT 100
`);

    res.json(result.rows);
  } catch (error) {
    console.error("Get movements error:", error);
    res.status(500).json({
      message: "Failed to retrieve movements",
    });
  }
});
  
// POST /api/movements/write-off
router.post("/write-off", requireRole("Admin", "Chemist"), async (req, res) => {
  const { lotId, quantity, reason, reference, notes } = req.body;

  const parsedLotId = Number(lotId);
  const parsedQuantity = Number(quantity);

  if (
    !Number.isInteger(parsedLotId) ||
    parsedLotId <= 0 ||
    !Number.isFinite(parsedQuantity) ||
    parsedQuantity <= 0 ||
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    res.status(400).json({ message: "Invalid write-off data" });
    return;
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Lock the lot to prevent concurrent write-offs.
    const lotResult = await client.query(
      `SELECT
         id,
         material_id,
         current_quantity,
         COALESCE(effective_expiry_date, expiry_date) AS expiry_date
       FROM lots
       WHERE id = $1
       FOR UPDATE`,
      [parsedLotId]
    );

    if (lotResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      res.status(404).json({ message: "Lot not found" });
      return;
    }

    const lot = lotResult.rows[0];
    const oldQuantity = Number(lot.current_quantity);

    if (parsedQuantity > oldQuantity) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(400).json({
        message: "Write-off quantity exceeds available balance",
        availableQuantity: oldQuantity,
      });
      return;
    }

    const newQuantity = oldQuantity - parsedQuantity;

    // Update lot balance and status.
    await client.query(
      `UPDATE lots
       SET
         current_quantity = $1,
         status = CASE
           WHEN $1 = 0 THEN 'DEPLETED'
           WHEN COALESCE(effective_expiry_date, expiry_date) < CURRENT_DATE
             THEN 'EXPIRED'
           ELSE 'ACTIVE'
         END,
         updated_at = NOW()
       WHERE id = $2`,
      [newQuantity, parsedLotId]
    );

    // Record stock movement.
    const movementResult = await client.query(
      `INSERT INTO movements (
         lot_id,
         movement_type,
         quantity_signed,
         reason,
         user_id,
         reference,
         material_id
       )
       VALUES ($1::integer, 'WRITE_OFF', $2::real, $3::text, $6::integer, $4::text, $5::integer)
       RETURNING id, movement_datetime`,
      [
  parsedLotId,
  -parsedQuantity,
  reason.trim(),
  reference?.trim() || null,
  lot.material_id,
  req.session.user?.id ?? null,
]
    );

    const movement = movementResult.rows[0];

    // Record audit event.
    await client.query(
      `INSERT INTO audit_trail (
         user_id,
         username,
         action,
         entity_type,
         record_id,
         field_name,
         old_value,
         new_value,
         details
       )
       VALUES (
  $5,
  $6,
  'WRITE_OFF',
         'LOT',
         $1,
         'current_quantity',
         $2,
         $3,
         $4
       )`,
      [
  String(parsedLotId),
  String(oldQuantity),
  String(newQuantity),
  `Write-off: ${parsedQuantity}; reason: ${reason.trim()}; reference: ${reference?.trim() || "N/A"}; notes: ${typeof notes === "string" && notes.trim() ? notes.trim() : "N/A"}`,
  req.session.user?.id ?? null,
  req.session.user?.username ?? null,
]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.status(201).json({
      message: "Write-off completed successfully",
      movementId: movement.id,
      movementDate: movement.movement_datetime,
      lotId: parsedLotId,
      oldQuantity,
      writtenOff: parsedQuantity,
      newQuantity,
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Write-off error:", error);
    res.status(500).json({ message: "Failed to complete write-off" });
  } finally {
    client.release();
  }
});
// POST /api/movements/adjustment
router.post("/adjustment", requireRole("Admin", "Chemist"), async (req, res) => {
  const { lotId, quantity, reason, reference, notes } = req.body;

  const parsedLotId = Number(lotId);
  const adjustment = Number(quantity);

  if (
    !Number.isInteger(parsedLotId) ||
    parsedLotId <= 0 ||
    !Number.isFinite(adjustment) ||
    adjustment === 0 ||
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    res.status(400).json({ message: "Invalid adjustment data" });
    return;
  }

  if (
    (reference !== undefined && typeof reference !== "string") ||
    (notes !== undefined && typeof notes !== "string")
  ) {
    res.status(400).json({ message: "Invalid reference or notes" });
    return;
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const lotResult = await client.query(
      `SELECT id, material_id, current_quantity,
              COALESCE(effective_expiry_date, expiry_date) AS expiry_date
       FROM lots
       WHERE id = $1
       FOR UPDATE`,
      [parsedLotId]
    );

    if (lotResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      res.status(404).json({ message: "Lot not found" });
      return;
    }

    const lot = lotResult.rows[0];
    const oldQuantity = Number(lot.current_quantity);
    const newQuantity = oldQuantity + adjustment;

    if (newQuantity < 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(400).json({
        message: "Adjustment cannot make the balance negative",
        availableQuantity: oldQuantity,
      });
      return;
    }

    await client.query(
      `UPDATE lots
       SET current_quantity = $1,
           status = CASE
             WHEN $1 = 0 THEN 'DEPLETED'
             WHEN COALESCE(effective_expiry_date, expiry_date) < CURRENT_DATE
               THEN 'EXPIRED'
             ELSE 'ACTIVE'
           END,
           updated_at = NOW()
       WHERE id = $2`,
      [newQuantity, parsedLotId]
    );

    const movementResult = await client.query(
      `INSERT INTO movements (
         lot_id,
         movement_type,
         quantity_signed,
         reason,
         user_id,
         reference,
         material_id
       )
       VALUES ($1, 'ADJUSTMENT', $2, $3, $4, $5, $6)
       RETURNING id, movement_datetime`,
      [
        parsedLotId,
        adjustment,
        reason.trim(),
        req.session.user?.id ?? null,
        reference?.trim() || null,
        lot.material_id,
      ]
    );

    const movement = movementResult.rows[0];

    const auditDetails = [
      `Adjustment: ${adjustment > 0 ? "+" : ""}${adjustment}`,
      `Reason: ${reason.trim()}`,
      `Reference: ${reference?.trim() || "N/A"}`,
      `Notes: ${notes?.trim() || "N/A"}`,
    ].join("; ");

    await client.query(
      `INSERT INTO audit_trail (
         user_id,
         username,
         action,
         entity_type,
         record_id,
         field_name,
         old_value,
         new_value,
         details
       )
       VALUES ($1, $2, 'ADJUSTMENT', 'LOT', $3,
               'current_quantity', $4, $5, $6)`,
      [
        req.session.user?.id ?? null,
        req.session.user?.username ?? null,
        String(parsedLotId),
        String(oldQuantity),
        String(newQuantity),
        auditDetails,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.status(201).json({
      message: "Adjustment completed successfully",
      movementId: movement.id,
      movementDate: movement.movement_datetime,
      lotId: parsedLotId,
      oldQuantity,
      adjustment,
      newQuantity,
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Adjustment error:", error);
    res.status(500).json({
      message: "Failed to complete adjustment",
    });
  } finally {
    client.release();
  }
});
export default router;
