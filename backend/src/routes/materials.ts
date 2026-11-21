
import { Router } from "express";
import { pool } from "../config/database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";


const router = Router();

// GET /api/materials
router.get("/", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        material_code AS "materialCode",
        material_type AS "materialType",
        unit,
        manufacturer,
        catalog_number AS "catalogNumber",
        min_stock AS "minStock",
        is_active AS "isActive",
        storage_conditions AS "storageConditions",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM materials
      ORDER BY name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get materials error:", error);
    res.status(500).json({ message: "Failed to retrieve materials" });
  }
});

// POST /api/materials
router.post("/", requireRole("Admin"), async (req, res) => {
  let client;

  try {
    const {
      name,
       materialCode,
      materialType,
      unit,
      manufacturer,
      catalogNumber,
      minStock,
      storageConditions,
    } = req.body;

   if (!name?.trim() || !materialCode?.trim() || !unit?.trim()) {
      res.status(400).json({ message: "Name and unit are required" });
      return;
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO materials (
  name, material_code, material_type, unit, manufacturer,
  catalog_number, min_stock, storage_conditions
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
  name.trim(),
  materialCode.trim(),
  materialType || null,
  unit.trim(),
  manufacturer || null,
  catalogNumber || null,
  minStock ?? 0,
  storageConditions || null,
]
    );

    const materialId = result.rows[0].id;

    await client.query(
      `INSERT INTO audit_trail (
        user_id,
        username,
        action,
        entity_type,
        record_id,
        details
      )
      VALUES ($1, $2, 'CREATE', 'MATERIAL', $3, $4)`,
      [
        req.session.user?.id ?? null,
        req.session.user?.username ?? null,
        String(materialId),
        `Material created: ${name.trim()}`,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Material created successfully",
      id: materialId,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

       if ((error as { code?: string })?.code === "23505") {
      res.status(409).json({ message: "Material code already exists" });
      return;
    }

console.error("Create material error:", error);
res.status(500).json({ message: "Failed to create material" });
  } finally {
    client?.release();
  }
});


// PUT /api/materials/:id
router.put("/:id", requireRole("Admin"), async (req, res) => {
  let client;

  try {
    const {
      name,
      materialType,
      materialCode,
      unit,
      manufacturer,
      catalogNumber,
      minStock,
      isActive,
      storageConditions,
    } = req.body;

    if (!name?.trim() || !unit?.trim()) {
      res.status(400).json({ message: "Name and unit are required" });
      return;
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const oldResult = await client.query(
      `SELECT
        name,
        material_code,
        material_type,
        unit,
        manufacturer,
        catalog_number,
        min_stock,
        is_active,
        storage_conditions
       FROM materials
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (oldResult.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "Material not found" });
      return;
    }

    const oldMaterial = oldResult.rows[0];

    const newMaterial = {
      name: name.trim(),
        material_code: materialCode?.trim() || oldMaterial.material_code,
      material_type: materialType || null,
      unit: unit.trim(),
      manufacturer: manufacturer || null,
      catalog_number: catalogNumber || null,
      min_stock: minStock ?? 0,
      is_active: isActive ?? true,
      storage_conditions: storageConditions || null,
    };

    await client.query(
      `UPDATE materials SET
        name = $1,
        material_code = $2,
        material_type = $3
                unit = $4,
        manufacturer = $5,
        catalog_number = $6,
        min_stock = $7,
        is_active = $8,
        storage_conditions = $9,
        updated_at = NOW()
      WHERE id = $10`,
      [
  newMaterial.name,
  newMaterial.material_code,
  newMaterial.material_type,
  newMaterial.unit,
  newMaterial.manufacturer,
  newMaterial.catalog_number,
  newMaterial.min_stock,
  newMaterial.is_active,
  newMaterial.storage_conditions,
  req.params.id,
]
    );

    const changes = [
  ["name", oldMaterial.name, newMaterial.name],
  ["material_code", oldMaterial.material_code, newMaterial.material_code],
  ["material_type", oldMaterial.material_type, newMaterial.material_type],
      ["unit", oldMaterial.unit, newMaterial.unit],
      ["manufacturer", oldMaterial.manufacturer, newMaterial.manufacturer],
      ["catalog_number", oldMaterial.catalog_number, newMaterial.catalog_number],
      ["min_stock", oldMaterial.min_stock, newMaterial.min_stock],
      ["is_active", oldMaterial.is_active, newMaterial.is_active],
      ["storage_conditions", oldMaterial.storage_conditions, newMaterial.storage_conditions],
    ];

    for (const [field, oldValue, newValue] of changes) {
      const isSame =
        field === "min_stock"
          ? Number(oldValue) === Number(newValue)
          : String(oldValue ?? "") === String(newValue ?? "");

      if (isSame) {
        continue;
      }

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
        VALUES ($1, $2, 'UPDATE', 'MATERIAL', $3, $4, $5, $6, $7)`,
        [
          req.session.user?.id ?? null,
          req.session.user?.username ?? null,
          String(req.params.id),
          field,
          oldValue === null ? null : String(oldValue),
          newValue === null ? null : String(newValue),
          `Material updated: ${newMaterial.name}`,
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ message: "Material updated successfully" });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Update material error:", error);
    res.status(500).json({ message: "Failed to update material" });
  } finally {
    client?.release();
  }
});


// PATCH /api/materials/:id/status

router.patch("/:id/status", requireRole("Admin"), async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({ message: "isActive must be a boolean" });
      return;
    }

    
    await client.query("BEGIN");
    transactionStarted = true;

    const currentResult = await client.query(
      `SELECT id, is_active
       FROM materials
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(404).json({ message: "Material not found" });
      return;
    }

    const oldStatus = currentResult.rows[0].is_active;

    if (oldStatus === isActive) {
      await client.query("COMMIT");
      transactionStarted = false;

      res.json({ message: "Material status unchanged" });
      return;
    }

    await client.query(
      `UPDATE materials
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2`,
      [isActive, req.params.id]
    );

    const action = isActive ? "ACTIVATE" : "DEACTIVATE";

    await client.query(
      `INSERT INTO audit_trail (
        user_id,
        username,
        action,
        entity_type,
        record_id,
        old_value,
        new_value,
        details
      )
      VALUES ($1, $2, $3, 'MATERIAL', $4, $5, $6, $7)`,
      [
        req.session.user?.id ?? null,
        req.session.user?.username ?? null,
        action,
        String(req.params.id),
        String(oldStatus),
        String(isActive),
        `Material ${isActive ? "activated" : "deactivated"}`,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.json({ message: "Material status updated successfully" });
  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Update material status error:", error);
    res.status(500).json({ message: "Failed to update material status" });
  } finally {
    client?.release();
  }
});


export default router;
