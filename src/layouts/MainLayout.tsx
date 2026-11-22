
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FlaskConical, Package, Warehouse,
  PackagePlus, ClipboardMinus, ArrowLeftRight,
  Users, History, Search, Bell, Settings, ChevronDown
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";

type GlobalMaterial = {
  id: number;
  name: string;
  materialCode: string | null;
  catalogNumber: string | null;
};

type GlobalLot = {
  id: number;
  lotNumber: string;
  materialId: number;
  material: string;
  currentQuantity: number | string;
};

type GlobalMovement = {
  id: number | string;
  material: string;
  lotNumber: string;
  reference: string | null;
  user: string;
};

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "INVENTORY",
    items: [
      { label: "Materials", path: "/materials", icon: FlaskConical },
      { label: "Lots", path: "/lots", icon: Package },
      { label: "Stock", path: "/stock", icon: Warehouse },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Receive", path: "/receive", icon: PackagePlus },
      { label: "Write-off", path: "/use", icon: ClipboardMinus },
      { label: "Movements", path: "/movements", icon: ArrowLeftRight },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { label: "Users", path: "/users", icon: Users },
      { label: "Audit Trail", path: "/audit", icon: History },
    ],
  },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMaterials, setSearchMaterials] = useState<GlobalMaterial[]>([]);
const [searchLots, setSearchLots] = useState<GlobalLot[]>([]);
const [searchMovements, setSearchMovements] = useState<GlobalMovement[]>([]);

useEffect(() => {
  if (!searchOpen) return;

  async function loadSearchData() {
    try {
      const [materials, lots, movements] = await Promise.all([
        api.get<GlobalMaterial[]>("/materials"),
        api.get<GlobalLot[]>("/lots"),
        api.get<GlobalMovement[]>("/movements"),
      ]);

      setSearchMaterials(materials);
      setSearchLots(lots);
      setSearchMovements(movements);
    } catch (error) {
      console.error("Failed to load global search data:", error);
    }
  }

  loadSearchData();
}, [searchOpen]);
const filteredSearchMaterials = useMemo(() => {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return [];

  return searchMaterials.filter(
  (item) =>
    item.name.toLowerCase().includes(query) ||
    (item.materialCode || "").toLowerCase().includes(query) ||
    String(item.id).includes(query) ||
    (item.catalogNumber || "").toLowerCase().includes(query)
);
}, [searchMaterials, searchQuery]);

const filteredSearchLots = useMemo(() => {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return [];

  return searchLots.filter(
    (item) =>
      item.lotNumber.toLowerCase().includes(query) ||
      String(item.id).includes(query) ||
      item.material.toLowerCase().includes(query)
  );
}, [searchLots, searchQuery]);

const filteredSearchMovements = useMemo(() => {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return [];

  return searchMovements.filter(
    (item) =>
      String(item.id).toLowerCase().includes(query) ||
      item.material.toLowerCase().includes(query) ||
      item.lotNumber.toLowerCase().includes(query) ||
      (item.reference || "").toLowerCase().includes(query) ||
      (item.user || "").toLowerCase().includes(query)
  );
}, [searchMovements, searchQuery]);

  const initials = (user?.fullName || user?.username || "U")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><FlaskConical size={23} /></div>
          <div>
            <h2>LabInventory</h2>
            <span>Laboratory Inventory Management System</span>
          </div>
        </div>

        

        <nav className="navigation">
          {navigation
            .filter(
              (group) =>
                group.title !== "ADMINISTRATION" ||
                user?.role === "Admin"
            )
            .map((group) => (
              <div className="nav-group" key={group.title}>
                <div className="nav-title">{group.title}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? "active" : ""}`
                      }
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <strong>{user?.fullName || user?.username}</strong>
            <span>{user?.role === "Admin" ? "System Admin" : "Chemist"}</span>
          </div>
          <Settings size={17} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Laboratory</span>
            <span className="breadcrumb-separator">/</span>
            <strong>Inventory Management</strong>
          </div>

          <div className="topbar-actions">
            {searchOpen && (
  <input
    type="text"
    className="global-search-input"
    placeholder="Search materials, lots, stock, movements..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    autoFocus
  />
)}
{searchOpen && searchQuery.trim() && (
  <div className="global-search-results">
    {filteredSearchMaterials.length > 0 && (
      <div className="global-search-group">
        <div className="global-search-heading">Materials</div>

        {filteredSearchMaterials.map((item) => (
          <button
            key={item.id}
            type="button"
            className="global-search-result"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
              navigate(`/materials?search=${encodeURIComponent(String(item.id))}`);
            }}
          >
            <strong>{item.name}</strong>
            <span>ID: {item.id} · Catalog: {item.catalogNumber || "—"}</span>
          </button>
        ))}
      </div>
    )}

    {filteredSearchLots.length > 0 && (
      <div className="global-search-group">
        <div className="global-search-heading">Lots</div>

        {filteredSearchLots.map((item) => (
          <button
            key={item.id}
            type="button"
            className="global-search-result"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
              navigate(`/lots?search=${encodeURIComponent(item.lotNumber)}`);
            }}
          >
            <strong>{item.lotNumber}</strong>
            <span>ID: {item.id} · Material: {item.material}</span>
          </button>
        ))}
      </div>
    )}

    {filteredSearchMovements.length > 0 && (
      <div className="global-search-group">
        <div className="global-search-heading">Movements</div>

        {filteredSearchMovements.map((item) => (
          <button
            key={item.id}
            type="button"
            className="global-search-result"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
              navigate(`/movements?search=${encodeURIComponent(String(item.id))}`);
            }}
          >
            <strong>{item.material}</strong>
            <span>ID: {item.id} · Lot: {item.lotNumber} · Ref: {item.reference || "—"}</span>
          </button>
        ))}
      </div>
    )}

    {filteredSearchMaterials.length === 0 &&
      filteredSearchLots.length === 0 &&
      filteredSearchMovements.length === 0 && (
        <div className="global-search-heading">No results found</div>
      )}
  </div>
)}
            <button
  className="icon-button"
  type="button"
  aria-label="Search"
  onClick={() => setSearchOpen((prev) => !prev)}
>
  <Search size={19} />
</button>
            <button className="icon-button notification" aria-label="Notifications">
              <Bell size={19} />
              <span />
            </button>
            <div className="topbar-divider" />
            <button
              className="topbar-user"
              type="button"
              onClick={handleLogout}
              title="Sign out"
            >
              <div className="user-avatar small">{initials}</div>
              <div>
                <strong>{user?.fullName || user?.username}</strong>
                <span>{user?.role === "Admin" ? "Admin account" : "Chemist account"}</span>
              </div>
              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
