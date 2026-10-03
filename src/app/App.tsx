import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { RequirePermission } from "../components/auth/RequirePermission";

const AuditLogsPage = lazy(() => import("../features/audit-logs/AuditLogsPage").then((module) => ({ default: module.AuditLogsPage })));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const DepartmentsPage = lazy(() => import("../features/departments/DepartmentsPage").then((module) => ({ default: module.DepartmentsPage })));
const DocumentsPage = lazy(() => import("../features/documents/DocumentsPage").then((module) => ({ default: module.DocumentsPage })));
const EmployeesPage = lazy(() => import("../features/employees/EmployeesPage").then((module) => ({ default: module.EmployeesPage })));
const MembersPage = lazy(() => import("../features/members/MembersPage").then((module) => ({ default: module.MembersPage })));
const PositionsPage = lazy(() => import("../features/positions/PositionsPage").then((module) => ({ default: module.PositionsPage })));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const SynchronizationPage = lazy(() => import("../features/synchronization/SynchronizationPage").then((module) => ({ default: module.SynchronizationPage })));
const UsersPage = lazy(() => import("../features/users/UsersPage").then((module) => ({ default: module.UsersPage })));
const OrganizationPage = lazy(() => import("../features/organization/OrganizationPage").then((module) => ({ default: module.OrganizationPage })));
const PaymentsPage = lazy(() => import("../features/payments/PaymentsPage").then((module) => ({ default: module.PaymentsPage })));

export function App() {
  return (
    <AppShell>
      <Suspense fallback={<div className="py-16 text-center text-sm text-ink/55">Loading workspace...</div>}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/members" element={<RequirePermission permission="members.view"><MembersPage /></RequirePermission>} />
          <Route path="/employees" element={<RequirePermission permission="employees.view"><EmployeesPage /></RequirePermission>} />
          <Route path="/payments" element={<RequirePermission permission="payments.view"><PaymentsPage /></RequirePermission>} />
          <Route path="/organization/departments" element={<RequirePermission permission="organization.view"><DepartmentsPage /></RequirePermission>} />
          <Route path="/organization/positions" element={<RequirePermission permission="organization.view"><PositionsPage /></RequirePermission>} />
          <Route path="/organization" element={<RequirePermission permission="organization.view"><OrganizationPage /></RequirePermission>} />
          <Route path="/documents" element={<RequirePermission permission="documents.view"><DocumentsPage /></RequirePermission>} />
          <Route path="/reports" element={<RequirePermission permission="reports.view"><ReportsPage /></RequirePermission>} />
          <Route path="/sync" element={<RequirePermission permission="sync.view"><SynchronizationPage /></RequirePermission>} />
          <Route path="/audit-logs" element={<RequirePermission permission="audit.view"><AuditLogsPage /></RequirePermission>} />
          <Route path="/settings" element={<RequirePermission permission="settings.view"><SettingsPage /></RequirePermission>} />
          <Route path="/settings/users" element={<RequirePermission permission="users.view"><UsersPage /></RequirePermission>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
