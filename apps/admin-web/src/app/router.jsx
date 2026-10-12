import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppShell } from "./AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { WorkersListPage } from "@/features/workers/WorkersListPage";
import { WorkerDetailPage } from "@/features/workers/WorkerDetailPage";
import { SitesListPage } from "@/features/sites/SitesListPage";
import { AttendancePage } from "@/features/attendance/AttendancePage";
import { PayrollPage } from "@/features/payroll/PayrollPage";
import { FinancePage } from "@/features/finance/FinancePage";
import { RequestsPage } from "@/features/requests/RequestsPage";
import { SupportPage } from "@/features/support/SupportPage";
import { PermissionsPage } from "@/features/permissions/PermissionsPage";
import { AuditLogsPage } from "@/features/audit/AuditLogsPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { WorkTypesPage } from "@/features/workTypes/WorkTypesPage";
import { UsersPage } from "@/features/users/UsersPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { MaterialsPage } from "@/features/materials/MaterialsPage";
import { EquipmentPage } from "@/features/equipment/EquipmentPage";
import { SiteDiaryPage } from "@/features/diary/SiteDiaryPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/workers" element={<WorkersListPage />} />
          <Route path="/workers/:id" element={<WorkerDetailPage />} />
          <Route path="/sites" element={<SitesListPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/permissions" element={<PermissionsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/work-types" element={<WorkTypesPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/site-diary" element={<SiteDiaryPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>);

}