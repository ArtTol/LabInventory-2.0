
import { useEffect, useState, type FormEvent } from "react";
import {
  PackagePlus, CalendarDays, ClipboardList,
  CheckCircle2, AlertCircle, RotateCcw
} from "lucide-react";
import { api } from "../services/api";

type Material = {
  id: number;
  name: string;
  unit: string;
  storageConditions?: string | null;
  isActive: boolean;
};

type Lot = {
  id: number | string;
  lotNumber: string;
  materialId: number | string;
  material: string;
  receivedDate: string;
  expiryDate: string;
  initialQuantity: number | string;
  currentQuantity: number | string;
  unit: string;
  storage: string | null;
  status: string;
};

type Receipt = {
  id: string;
  material: string;
  lotNumber: string;
  receivedDate: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  supplier: string;
  reference: string;
  storage: string;
};

function getLocalDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}

const today = getLocalDate();

function Receive() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    material: "",
    lotNumber: "",
    receivedDate: today,
    expiryDate: "",
    quantity: "",
    unit: "ml",
    supplier: "",
    reference: "",
    storage: "",
    notes: "",
  });

  const selectedMaterial = materials.find(
    (item) => item.name === form.material
  );

  function mapLotsToReceipts(lots: Lot[]): Receipt[] {
    return lots.map((lot) => ({
      id: `REC-${lot.id}`,
      material: lot.material,
      lotNumber: lot.lotNumber,
      receivedDate: lot.receivedDate,
      expiryDate: lot.expiryDate,
      quantity: Number(lot.initialQuantity),
      unit: lot.unit,
      supplier: "",
      reference: "",
      storage: lot.storage || "",
    }));
  }

  async function loadData() {
    const [materialsData, lotsData] = await Promise.all([
      api.get<Material[]>("/materials"),
      api.get<Lot[]>("/lots"),
    ]);

    setMaterials(materialsData.filter((item) => item.isActive));
    setReceipts(mapLotsToReceipts(lotsData));
  }

  useEffect(() => {
    loadData().catch((error) => {
      console.error("Receive data loading error:", error);
      alert("Failed to load materials and receipt history.");
    });
  }, []);

  function selectMaterial(name: string) {
    const material = materials.find((item) => item.name === name);

    setForm((previous) => ({
      ...previous,
      material: name,
      unit: material?.unit || "ml",
      storage: material?.storageConditions || "",
    }));
  }

  function resetForm() {
    setForm({
      material: "",
      lotNumber: "",
      receivedDate: today,
      expiryDate: "",
      quantity: "",
      unit: "ml",
      supplier: "",
      reference: "",
      storage: "",
      notes: "",
    });
    setSuccess(false);
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(form.quantity);

    if (
      !selectedMaterial ||
      !form.lotNumber.trim() ||
      !form.expiryDate ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      form.expiryDate < form.receivedDate
    ) {
      alert("Please check the required fields and dates.");
      return;
    }

    try {
      await api.post("/lots", {
        lotNumber: form.lotNumber.trim(),
        materialId: selectedMaterial.id,
        receivedDate: form.receivedDate,
        expiryDate: form.expiryDate,
        initialQuantity: quantity,
        currentQuantity: quantity,
        storage: form.storage.trim(),
        supplier: form.supplier.trim(),
        reference: form.reference.trim(),
        notes: form.notes.trim(),
      });

      await loadData();
      setSuccess(true);
      resetFormAfterSuccess();
    } catch (error) {
      console.error("Receipt registration error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to register receipt."
      );
    }
  }

  function resetFormAfterSuccess() {
    setForm({
      material: "",
      lotNumber: "",
      receivedDate: today,
      expiryDate: "",
      quantity: "",
      unit: "ml",
      supplier: "",
      reference: "",
      storage: "",
      notes: "",
    });
  }

  return (
    <div className="receive-page">
      <div className="page-heading">
        <div>
          <h1>Receive materials</h1>
          <p>Register incoming materials and create new inventory lots.</p>
        </div>
        <div className="receive-heading-icon">
          <PackagePlus size={22} />
        </div>
      </div>

      {success && (
        <div className="receive-success">
          <CheckCircle2 size={19} />
          <div>
            <strong>Receipt registered successfully</strong>
            <span>
              The lot was successfully saved to the inventory.
            </span>
          </div>
          <button onClick={() => setSuccess(false)}>Dismiss</button>
        </div>
      )}

      <form onSubmit={submitReceipt}>
        <div className="receive-layout">
          <div className="receive-main">
            <section className="panel receive-section">
              <div className="receive-section-heading">
                <div className="receive-section-icon">
                  <PackagePlus size={17} />
                </div>
                <div>
                  <h2>Material information</h2>
                  <p>Select the material being received.</p>
                </div>
              </div>

              <div className="receive-form-grid">
                <label className="form-field full">
                  Material *
                  <select
                    required
                    value={form.material}
                    onChange={(e) => selectMaterial(e.target.value)}
                  >
                    <option value="">Select material</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.name}>
                        {material.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  Supplier
                  <input
                    value={form.supplier}
                    onChange={(e) =>
                      setForm({ ...form, supplier: e.target.value })
                    }
                    placeholder="Supplier name"
                  />
                </label>

                <label className="form-field">
                  Document reference
                  <input
                    value={form.reference}
                    onChange={(e) =>
                      setForm({ ...form, reference: e.target.value })
                    }
                    placeholder="Invoice or delivery note"
                  />
                </label>
              </div>
            </section>

            <section className="panel receive-section">
              <div className="receive-section-heading">
                <div className="receive-section-icon">
                  <ClipboardList size={17} />
                </div>
                <div>
                  <h2>Lot information</h2>
                  <p>Enter batch identification and expiry information.</p>
                </div>
              </div>

              <div className="receive-form-grid">
                <label className="form-field full">
                  Supplier lot number *
                  <input
                    required
                    value={form.lotNumber}
                    onChange={(e) =>
                      setForm({ ...form, lotNumber: e.target.value })
                    }
                    placeholder="Enter the manufacturer's lot number"
                  />
                </label>

                <label className="form-field">
                  Received date *
                  <input
                    required
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) =>
                      setForm({ ...form, receivedDate: e.target.value })
                    }
                  />
                </label>

                <label className="form-field">
                  Expiry date *
                  <input
                    required
                    type="date"
                    min={form.receivedDate}
                    value={form.expiryDate}
                    onChange={(e) =>
                      setForm({ ...form, expiryDate: e.target.value })
                    }
                  />
                </label>
              </div>
            </section>

            <section className="panel receive-section">
              <div className="receive-section-heading">
                <div className="receive-section-icon">
                  <CalendarDays size={17} />
                </div>
                <div>
                  <h2>Quantity and storage</h2>
                  <p>Specify the received quantity and storage conditions.</p>
                </div>
              </div>

              <div className="receive-form-grid">
                <label className="form-field">
                  Received quantity *
                  <input
                    required
                    type="number"
                    min="0.001"
                    step="any"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </label>

                <label className="form-field">
                  Unit *
                  <select
                    required
                    value={form.unit}
                    onChange={(e) =>
                      setForm({ ...form, unit: e.target.value })
                    }
                  >
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                    <option value="g">g</option>
                    <option value="g">mg</option>
                    <option value="kg">kg</option>
                    <option value="pcs">pcs</option>
                  </select>
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

                <label className="form-field full">
                  Notes
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    placeholder="Additional information about this receipt..."
                  />
                </label>
              </div>
            </section>

            <div className="receive-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                <RotateCcw size={15} /> Reset form
              </button>
              <button type="submit" className="primary-button">
                <PackagePlus size={16} /> Register receipt
              </button>
            </div>
          </div>

          <aside className="receive-sidebar">
            <section className="panel receive-summary-panel">
              <h3>Receipt summary</h3>
              <p>Review the information before registering.</p>

              <div className="receive-summary-line">
                <span>Material</span>
                <strong>{form.material || "Not selected"}</strong>
              </div>
              <div className="receive-summary-line">
                <span>Lot number</span>
                <strong>{form.lotNumber || "—"}</strong>
              </div>
              <div className="receive-summary-line">
                <span>Received date</span>
                <strong>{form.receivedDate || "—"}</strong>
              </div>
              <div className="receive-summary-line">
                <span>Expiry date</span>
                <strong>{form.expiryDate || "—"}</strong>
              </div>

              <div className="receive-summary-total">
                <span>Received quantity</span>
                <strong>
                  {form.quantity
                    ? `${Number(form.quantity).toLocaleString()} ${form.unit}`
                    : "0"}
                </strong>
              </div>
            </section>

            <section className="receive-info-card">
              <AlertCircle size={18} />
              <div>
                <strong>Important</strong>
                <p>
                  Verify the lot number and expiry date against the supplier's
                  original packaging before registering the receipt.
                </p>
              </div>
            </section>

            {selectedMaterial && (
              <section className="panel receive-storage-card">
                <span>Default storage</span>
                <strong>{selectedMaterial.storageConditions || "—"}</strong>
                <span>Default unit</span>
                <strong>{selectedMaterial.unit}</strong>
              </section>
            )}
          </aside>
        </div>
      </form>

      {receipts.length > 0 && (
        <section className="panel receive-history">
          <div className="receive-section-heading">
            <div className="receive-section-icon">
              <ClipboardList size={17} />
            </div>
            <div>
              <h2>Recent receipts</h2>
              <p>Receipt lots saved in the inventory.</p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt ID</th>
                  <th>Material</th>
                  <th>Lot number</th>
                  <th>Received date</th>
                  <th>Quantity</th>
                  <th>Supplier</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>{receipt.id}</td>
                    <td>{receipt.material}</td>
                    <td>{receipt.lotNumber}</td>
                    <td>{receipt.receivedDate}</td>
                    <td>
                      {receipt.quantity.toLocaleString()} {receipt.unit}
                    </td>
                    <td>{receipt.supplier || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default Receive;
