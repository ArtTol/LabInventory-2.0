
import {
  FlaskConical,
  Package,
  AlertTriangle,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Clock3,
  Activity,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../services/api";

type MaterialApi = {
  id: number | string;
  name: string;
  unit: string;
  minStock: number | string;
  isActive: boolean;
};

type LotApi = {
  id: number | string;
  lotNumber: string;
  materialId: number | string;
  material: string;
  expiryDate: string;
  effectiveExpiryDate: string;
  receivedDate: string;
  currentQuantity: number | string;
  unit: string;
  status: string;
};

type MovementApi = {
  id: number | string;
  movementDate: string;
  movementType: "RECEIPT" | "WRITE_OFF" | "ADJUSTMENT";
  material: string;
  lotNumber: string;
  quantity: number | string;
  unit: string;
  reason: string | null;
  reference: string | null;
};

function localDateString(date = new Date()): string {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

function daysBetween(dateString: string, todayString: string): number {
  const date = new Date(`${dateString}T00:00:00Z`).getTime();
  const today = new Date(`${todayString}T00:00:00Z`).getTime();

  return Math.round((date - today) / 86400000);
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString();
}

function formatQuantity(value: number | string): string {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

export default function Dashboard() {
  const [apiStatus, setApiStatus] = useState("Checking...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [materials, setMaterials] = useState<MaterialApi[]>([]);
  const [lots, setLots] = useState<LotApi[]>([]);
  const [movements, setMovements] = useState<MovementApi[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [health, materialsData, lotsData, movementsData] =
          await Promise.all([
            api.get<{ status: string }>("/health"),
            api.get<MaterialApi[]>("/materials"),
            api.get<LotApi[]>("/lots"),
            api.get<MovementApi[]>("/movements"),
          ]);

        if (cancelled) return;

        setApiStatus(health.status);
        setMaterials(materialsData);
        setLots(lotsData);
        setMovements(movementsData);
      } catch (err) {
        if (cancelled) return;

        console.error("Dashboard loading error:", err);
        setApiStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard data."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const today = localDateString();

  const activeMaterials = materials.filter(
    (material) => material.isActive
  );

  const activeLots = lots.filter(
    (lot) => lot.status === "ACTIVE"
  );

  const lowStockItems = activeMaterials.filter((material) => {
    const materialQuantity = lots
      .filter(
        (lot) =>
          String(lot.materialId) === String(material.id)
      )
      .reduce(
        (total, lot) => total + Number(lot.currentQuantity || 0),
        0
      );

    return materialQuantity < Number(material.minStock || 0);
  });

  const expiringLots = lots
    .filter((lot) => {
      const quantity = Number(lot.currentQuantity || 0);
      const days = daysBetween(lot.effectiveExpiryDate || lot.expiryDate, today);

      return (
        lot.status === "ACTIVE" &&
        quantity > 0 &&
        days >= 0 &&
        days <= 30
      );
    })
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const stats = [
    {
      title: "Total Materials",
      value: materials.length,
      change: "In material catalog",
      positive: true,
      icon: FlaskConical,
      color: "blue",
    },
    {
      title: "Active Lots",
      value: activeLots.length,
      change: "Available batches",
      positive: true,
      icon: Package,
      color: "purple",
    },
    {
      title: "Low Stock Items",
      value: lowStockItems.length,
      change: "Requires attention",
      positive: false,
      icon: AlertTriangle,
      color: "orange",
    },
    {
      title: "Expiring Soon",
      value: expiringLots.length,
      change: "Next 30 days",
      positive: false,
      icon: CalendarClock,
      color: "red",
    },
  ];

  const recentActivities = movements.slice(0, 5);

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY MANAGEMENT</div>
          <h1>Dashboard</h1>
          <p>Here’s what’s happening in your lab</p>
          <p>
            API Status:{" "}
            <strong>{apiStatus}</strong>
          </p>
        </div>

        <Link to="/receive" className="primary-button">
          <Plus size={17} />
          Receive Material
        </Link>
      </div>

      {error && (
        <div className="panel">
          <div className="activity-item">
            <AlertTriangle size={18} color="#df6262" />
            <div className="activity-info">
              <strong>Failed to load dashboard data</strong>
              <span>{error}</span>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div className="stat-card" key={stat.title}>
              <div className="stat-top">
                <span>{stat.title}</span>
                <div className={`stat-icon ${stat.color}`}>
                  <Icon size={20} />
                </div>
              </div>

              <div className="stat-value">
                {loading ? "—" : stat.value}
              </div>

              <div
                className={`stat-change ${
                  stat.positive ? "positive" : "negative"
                }`}
              >
                {stat.positive ? (
                  <ArrowUpRight size={14} />
                ) : (
                  <ArrowDownRight size={14} />
                )}
                {stat.change}
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest inventory movements</p>
            </div>

            <Link to="/movements" className="text-link">
              View All
            </Link>
          </div>

          <div className="activity-list">
            {loading ? (
              <p>Loading activity...</p>
            ) : recentActivities.length === 0 ? (
              <p>No write-off records yet.</p>
            ) : (
              recentActivities.map((item) => (
                <div className="activity-item" key={item.id}>
  <div className={`activity-icon ${item.movementType === "RECEIPT" ? "receive" : "use"}`}>
    {item.movementType === "RECEIPT" ? (
      <ArrowDownRight size={17} />
    ) : (
      <ArrowUpRight size={17} />
    )}
  </div>

  <div className="activity-info">
    <strong>
      {item.movementType === "RECEIPT"
        ? "Material received"
        : item.movementType === "WRITE_OFF"
        ? "Material written off"
        : "Inventory adjusted"}
    </strong>
    <span>
      {item.material} · Lot {item.lotNumber}
    </span>
    <small>
      <Clock3 size={12} />
      {new Date(item.movementDate).toLocaleString()}
    </small>
  </div>

  <div className={`activity-quantity ${Number(item.quantity) >= 0 ? "receive" : "use"}`}>
  {Number(item.quantity) > 0 ? "+" : ""}
  {formatQuantity(item.quantity)} {item.unit}
</div>
</div>
              ))
            )}
          </div>

          <Link to="/movements" className="panel-footer-link">
            View Movement History
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Expiry Alerts</h2>
              <p>Lots expiring in the next 30 days</p>
            </div>

            <span className="alert-count">
              {loading ? "—" : expiringLots.length}
            </span>
          </div>

          <div className="alert-list">
            {loading ? (
              <p>Loading expiry information...</p>
            ) : expiringLots.length === 0 ? (
              <p>No lots expiring in the next 30 days.</p>
            ) : (
              expiringLots.slice(0, 3).map((lot) => {
                const days = daysBetween(lot.expiryDate, today);

                const daysLabel =
                  days === 0
                    ? "Expires today"
                    : days === 1
                    ? "1 day left"
                    : `${days} days left`;

                const severity =
                  days <= 7 ? "danger" : "warning";

                return (
                  <div className="alert-item" key={lot.id}>
                    <div
                      className={`alert-indicator ${severity}`}
                    />

                    <div className="alert-info">
                      <strong>{lot.material}</strong>
                      <span>Lot {lot.lotNumber}</span>
                      <small>
                        Expires: {formatDate(lot.expiryDate)}
                      </small>
                    </div>

                    <span className={`alert-days ${severity}`}>
                      {daysLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <Link to="/stock" className="panel-footer-link">
            View Stock
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      

      <div className="dashboard-note">
        <Activity size={15} />
        <span>
          {loading
            ? "Loading inventory data..."
            : error
            ? "Dashboard data could not be loaded."
            : "Dashboard displays live inventory data from PostgreSQL."}
        </span>
      </div>
    </div>
  );
}
