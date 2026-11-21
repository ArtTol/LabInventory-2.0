
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { FormEvent } from "react";
import {
  Plus, Search, Download, Filter, MoreHorizontal,
  FlaskConical, Pencil, Power, X
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type Material = {
  id: number;
  name: string;
  materialCode: string;
  type: string;
  unit: string;
  manufacturer: string;
  catalogNumber: string;
  minStock: number;
  storage: string;
  active: boolean;
};

type MaterialApi = {
  id: number;
  name: string;
  materialCode: string;
  materialType: string | null;
  unit: string;
  manufacturer: string | null;
  catalogNumber: string | null;
  minStock: number | string;
  isActive: boolean;
  storageConditions: string | null;
};

const emptyForm = {
  name: "",
  materialCode: "",
  type: "Reagent",
  unit: "g",
  manufacturer: "",
  catalogNumber: "",
  minStock: "0",
  storage: "Room temperature",
};

function mapMaterial(item: MaterialApi): Material {
  return {
  id: Number(item.id),
  name: item.name,
  materialCode: item.materialCode || "",
  type: item.materialType || "Other",
    unit: item.unit,
    manufacturer: item.manufacturer || "",
    catalogNumber: item.catalogNumber || "",
    minStock: Number(item.minStock),
    storage: item.storageConditions || "",
    active: item.isActive,
  };
}

export default function Materials() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
const isAdmin = user?.role === "Admin";
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadMaterials() {
    setLoading(true);
    setError("");

    try {
      const result = await api.get<MaterialApi[]>("/materials");
      setMaterials(result.map(mapMaterial));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load materials"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMaterials();
  }, []);
  useEffect(() => {
  const query = searchParams.get("search");

  if (query) {
    setSearch(query);
  }
}, [searchParams]);

  const filtered = useMemo(() => {
    return materials.filter((item) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        item.name.toLowerCase().includes(searchValue) ||
        String(item.id).includes(search) ||
        item.catalogNumber.toLowerCase().includes(searchValue);

      const matchesType =
        typeFilter === "All" || item.type === typeFilter;

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" ? item.active : !item.active);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [materials, search, typeFilter, statusFilter]);

  const activeCount = materials.filter((m) => m.active).length;

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setModalOpen(true);
  }

  function openEdit(item: Material) {
    setEditingId(item.id);
    setForm({
  name: item.name,
  materialCode: item.materialCode,
  type: item.type,
      unit: item.unit,
      manufacturer: item.manufacturer,
      catalogNumber: item.catalogNumber,
      minStock: String(item.minStock),
      storage: item.storage,
    });
    setError("");
    setModalOpen(true);
  }

  async function saveMaterial(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const minStock = Number(form.minStock);

    if (!Number.isFinite(minStock) || minStock < 0) {
      setError("Minimum stock must be a valid non-negative number.");
      return;
    }

    const data = {
  name: form.name.trim(),
  materialCode: form.materialCode.trim(),
  materialType: form.type,
      unit: form.unit,
      manufacturer: form.manufacturer.trim(),
      catalogNumber: form.catalogNumber.trim(),
      minStock,
      storageConditions: form.storage,
    };

    setSaving(true);

    try {
      if (editingId !== null) {
        const existing = materials.find((item) => item.id === editingId);

        await api.put(`/materials/${editingId}`, {
          ...data,
          isActive: existing?.active ?? true,
        });
      } else {
        await api.post("/materials", data);
      }

      await loadMaterials();
      setModalOpen(false);
      setForm({ ...emptyForm });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save material"
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: number) {
    const item = materials.find((material) => material.id === id);
    if (!item) return;

    setError("");

    try {
      await api.patch(`/materials/${id}/status`, {
  isActive: !item.active,
});

      await loadMaterials();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update material status"
      );
    }
  }

  function exportCSV() {
    const header = [
      "Material ID", "Name", "Material Type", "Unit",
      "Manufacturer", "Catalog Number", "Min Stock",
      "Storage Conditions", "Active",
    ];

    const rows = materials.map((m) => [
      m.id, m.name, m.type, m.unit, m.manufacturer,
      m.catalogNumber, m.minStock, m.storage, m.active ? "YES" : "NO",
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "materials.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="materials-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">INVENTORY MANAGEMENT</div>
          <h1>Materials</h1>
          <p>Manage your laboratory reagent catalog.</p>
        </div>

              {isAdmin && (
          <button className="primary-button" onClick={openNew}>
            <Plus size={17} />
            Add Material
          </button>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="material-summary">
        <div>
          <span>Total Materials</span>
          <strong>{materials.length}</strong>
        </div>
        <div>
          <span>Active Materials</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Inactive Materials</span>
          <strong>{materials.length - activeCount}</strong>
        </div>
      </div>

      <section className="panel materials-panel">
        <div className="materials-toolbar">
          <div className="material-search">
            <Search size={17} />
            <input
              placeholder="Search by name, ID or catalog number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </div>

          <div className="filter-control">
            <Filter size={15} />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">All types</option>
              <option value="Solvent">Solvent</option>
              <option value="Reagent">Reagent</option>
              <option value="Acid">Acid</option>
              <option value="Base">Base</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <select
            className="status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <button className="secondary-button" onClick={exportCSV}>
            <Download size={16} />
            Export
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Material Code</th>
                <th>Material ID</th>
                <th>Type</th>
                <th>Unit</th>
                <th>Manufacturer</th>
                <th>Catalog Number</th>
                <th>Min. Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="empty-table">
                    Loading materials...
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="material-name-cell">
                          <div className="material-avatar">
                            <FlaskConical size={17} />
                          </div>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.storage}</span>
                          </div>
                        </div>
                      </td>
                                            <td>{item.materialCode}</td>
                      <td>
                        <span className="id-label">#{item.id}</span>
                      </td>
                      <td>
                        <span className="type-label">{item.type}</span>
                      </td>
                      <td>{item.unit}</td>
                      <td>{item.manufacturer}</td>
                      <td>{item.catalogNumber}</td>
                      <td>
                        {item.minStock.toLocaleString()} {item.unit}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${item.active ? "active" : "inactive"}`}
                        >
                          <span />
                          {item.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
  {isAdmin && (
    <>
      <button
        title="Edit material"
        onClick={() => openEdit(item)}
      >
        <Pencil size={15} />
      </button>
      <button
        title={item.active ? "Deactivate" : "Activate"}
        onClick={() => void toggleStatus(item.id)}
      >
        <Power size={15} />
      </button>
      <button
        title="More options"
        onClick={() => openEdit(item)}
      >
        <MoreHorizontal size={17} />
      </button>
    </>
  )}
</div>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="empty-table">
                        No materials found. Try changing your search or filters.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Showing <strong>{filtered.length}</strong> of{" "}
            <strong>{materials.length}</strong> materials
          </span>
          <span>Connected to PostgreSQL</span>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="material-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{editingId !== null ? "Edit Material" : "Add Material"}</h2>
                <p>Enter the material information below.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setModalOpen(false)}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveMaterial}>
              <div className="form-grid">
                <label className="form-field full">
                  Material Name *
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="e.g. Acetonitrile"
                  />
                </label>
                <label className="form-field">
  Material Code *
  <input
    required
    value={form.materialCode}
    onChange={(e) =>
      setForm({ ...form, materialCode: e.target.value })
    }
    placeholder="e.g. A-1"
  />
</label>

                <label className="form-field">
                  Material Type *
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value })
                    }
                  >
                    <option>Reagent</option>
                    <option>Solvent</option>
                    <option>Acid</option>
                    <option>Base</option>
                    <option>Other</option>
                  </select>
                </label>

                <label className="form-field">
                  Unit *
                  <select
                    value={form.unit}
                    onChange={(e) =>
                      setForm({ ...form, unit: e.target.value })
                    }
                  >
                    <option>g</option>
                    <option>kg</option>
                    <option>ml</option>
                    <option>L</option>
                    <option>pcs</option>
                  </select>
                </label>

                <label className="form-field">
                  Manufacturer
                  <input
                    value={form.manufacturer}
                    onChange={(e) =>
                      setForm({ ...form, manufacturer: e.target.value })
                    }
                    placeholder="Manufacturer"
                  />
                </label>

                <label className="form-field">
                  Catalog Number
                  <input
                    value={form.catalogNumber}
                    onChange={(e) =>
                      setForm({ ...form, catalogNumber: e.target.value })
                    }
                    placeholder="Catalog number"
                  />
                </label>

                <label className="form-field">
                  Minimum Stock
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.minStock}
                    onChange={(e) =>
                      setForm({ ...form, minStock: e.target.value })
                    }
                  />
                </label>

                <label className="form-field">
                  Storage Conditions
                  <select
                    value={form.storage}
                    onChange={(e) =>
                      setForm({ ...form, storage: e.target.value })
                    }
                  >
                    <option>Room temperature</option>
                    <option>Refrigerated (2–8°C)</option>
                    <option>Frozen</option>
                    <option>Flammable cabinet</option>
                    <option>Acid cabinet</option>
                    <option>Dry storage</option>
                  </select>
                </label>
              </div>

              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save Changes"
                      : "Add Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
