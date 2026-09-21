import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Building2,
  ClipboardCheck,
  Wallet,
  Receipt,
  FileCheck,
  MessagesSquare,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Settings,
  LogOut,
  Truck,
  Package,
  Wrench,
  BookOpen } from
"lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useLogout } from "@/features/auth/api";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ToastProvider } from "@/components/ui/Toast";
import { cx } from "@/lib/format";

const NAV_GROUPS =

[
{ label: "", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
{
  label: "Workforce",
  items: [
  { to: "/workers", label: "Workers", icon: Users },
  { to: "/sites", label: "Sites", icon: Building2 }]

},
{
  label: "Attendance & Payroll",
  items: [
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/payroll", label: "Payroll", icon: Wallet }]

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
  { to: "/settings", label: "Settings", icon: Settings }]

}];

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <ToastProvider>
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 shrink-0 flex-col border-r border-steel-200 bg-surface">
        <div className="border-b border-steel-200 px-5 py-4">
          <p className="font-display text-sm font-semibold tracking-tight text-graphite-900">Ananta Infratech</p>
          <p className="text-xs text-graphite-500">Solutions</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, gi) =>
          <div key={gi} className="mb-4">
              {group.label &&
            <p className="mb-1.5 px-2 font-display text-[11px] font-semibold uppercase tracking-wider text-graphite-300">
                  {group.label}
                </p>
            }
              <ul className="space-y-0.5">
                {group.items.map((item) =>
              <li key={item.to}>
                    <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                  cx(
                    "flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors duration-150",
                    isActive ?
                    "ledger-rule bg-amber-50 pl-3 font-medium text-graphite-900" :
                    "text-graphite-500 hover:bg-steel-100 hover:text-graphite-900"
                  )
                  }>
                  
                      <item.icon size={16} strokeWidth={2} />
                      {item.label}
                    </NavLink>
                  </li>
              )}
              </ul>
            </div>
          )}
        </nav>

        <div className="border-t border-steel-200 px-4 py-3">
          <p className="truncate text-sm font-medium text-graphite-900">{user?.name}</p>
          <p className="text-xs text-graphite-500">{user?.role.replace("_", " ")}</p>
          <button
            onClick={() => logout.mutate()}
            className="mt-2 flex items-center gap-1.5 text-xs text-graphite-500 hover:text-rust transition-colors duration-150">
            
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-steel-200 bg-surface px-6">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
    </ToastProvider>);

}