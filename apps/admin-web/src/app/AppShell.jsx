import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessagesSquare,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useLogout } from "@/features/auth/api";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ToastProvider } from "@/components/ui/Toast";
import { MusicPlayer, MusicProvider } from "@/features/music/MusicPlayer";
import { cx } from "@/lib/format";

const NAV_GROUPS = [
  { label: "", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Workforce",
    items: [
      { to: "/workers", label: "Workers", icon: Users },
      { to: "/sites", label: "Sites", icon: Building2 }
    ]
  },
  {
    label: "Attendance & Payroll",
    items: [
      { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
      { to: "/payroll", label: "Payroll", icon: Wallet }
    ]
  },
  {
    label: "Finance",
    items: [{ to: "/finance", label: "Income, Expenses & P/L", icon: Receipt }]
  },
  {
    label: "Procurement",
    items: [
      { to: "/suppliers", label: "Suppliers / Vendors", icon: Truck },
      { to: "/materials", label: "Materials & Inventory", icon: Package }
    ]
  },
  {
    label: "Operations",
    items: [
      { to: "/equipment", label: "Equipment & Tools", icon: Wrench },
      { to: "/site-diary", label: "Site Diary", icon: BookOpen }
    ]
  },
  {
    label: "Requests",
    items: [{ to: "/requests", label: "Advances & Kharchi", icon: FileCheck }]
  },
  {
    label: "Communication",
    items: [{ to: "/support", label: "Support Chat", icon: MessagesSquare }]
  },
  {
    label: "Governance",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3 },
      { to: "/permissions", label: "Permissions", icon: ShieldCheck },
      { to: "/users", label: "Users", icon: UserCog },
      { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
      { to: "/settings", label: "Settings", icon: Settings }
    ]
  }
];

function pageMeta(pathname) {
  const match = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.to !== "/" && pathname.startsWith(item.to));
  return match ?? { label: "Dashboard", icon: LayoutDashboard };
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentPage = pageMeta(location.pathname);
  const CurrentIcon = currentPage.icon;

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <MusicProvider>
      <ToastProvider>
        <div className="app-shell relative flex min-h-screen overflow-hidden bg-paper">
          <div className="ambient-orb ambient-orb-one" />
          <div className="ambient-orb ambient-orb-two" />

          {sidebarOpen && <button type="button" aria-label="Close navigation" className="sidebar-backdrop lg:hidden" onClick={closeSidebar} />}

          <aside className={cx("app-sidebar", sidebarOpen ? "app-sidebar-open" : "app-sidebar-closed")}>
            <div className="brand-block">
              <div className="brand-mark"><Sparkles size={19} /></div>
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-bold tracking-tight text-white">Ananta Infratech</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Operations OS</p>
              </div>
              <button type="button" className="sidebar-close lg:hidden" onClick={closeSidebar} aria-label="Close navigation"><X size={18} /></button>
            </div>

            <nav className="app-nav">
              {NAV_GROUPS.map((group, groupIndex) => (
                <div key={group.label || groupIndex} className="nav-section">
                  {group.label && <p className="nav-section-label">{group.label}</p>}
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.to === "/"}
                          onClick={closeSidebar}
                          className={({ isActive }) => cx("nav-item", isActive && "nav-item-active")}>
                          <item.icon size={17} strokeWidth={isActiveIcon(item, location.pathname) ? 2.25 : 1.8} />
                          <span className="truncate">{item.label}</span>
                          {item.to === "/support" && <MessageCircle size={13} className="ml-auto text-white/25" />}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="sidebar-status">
              <div className="flex items-center gap-2">
                <span className="live-pulse"><span /></span>
                <span>Workspace live</span>
              </div>
              <span className="text-white/35">v1.0</span>
            </div>

            <div className="profile-block">
              <div className="profile-avatar">{user?.name?.slice(0, 1)?.toUpperCase() || "A"}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user?.name || "Administrator"}</p>
                <p className="truncate text-[11px] text-white/45">{user?.role?.replace(/_/g, " ") || "Admin"}</p>
              </div>
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="profile-logout"
                title="Sign out"
                aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          </aside>

          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <header className="app-header">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" className="mobile-menu-button lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
                  <Menu size={20} />
                </button>
                <div className="page-heading">
                  <div className="page-heading-icon"><CurrentIcon size={16} /></div>
                  <div className="min-w-0">
                    <p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-graphite-300 sm:block">Ananta workspace</p>
                    <h1 className="truncate font-display text-sm font-bold text-graphite-900 sm:text-base">{currentPage.label}</h1>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-teal/15 bg-teal-50 px-3 py-1.5 text-[11px] font-semibold text-teal md:flex">
                  <CheckCircle2 size={13} /> All systems connected
                </div>
                <MusicPlayer />
                <NotificationBell />
              </div>
            </header>

            <main className="app-main">
              <div key={`${location.pathname}${location.search}`} className="page-enter">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </MusicProvider>
  );
}

function isActiveIcon(item, pathname) {
  return item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
}
