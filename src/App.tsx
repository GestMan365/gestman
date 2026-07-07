import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/security/ProtectedRoute";
import { AdministrationPage } from "@/pages/AdministrationPage";
import { AssetsPage } from "@/pages/AssetsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PcmPage } from "@/pages/PcmPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { RequestsPage } from "@/pages/RequestsPage";
import { WorkOrdersPage } from "@/pages/WorkOrdersPage";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={<ProtectedRoute moduleKey="dashboard"><DashboardPage /></ProtectedRoute>}
            />
            <Route
              path="/ativos"
              element={<ProtectedRoute moduleKey="ativos"><AssetsPage /></ProtectedRoute>}
            />
            <Route
              path="/solicitacoes"
              element={<ProtectedRoute moduleKey="solicitacoes"><RequestsPage /></ProtectedRoute>}
            />
            <Route
              path="/ordens-servico"
              element={<ProtectedRoute moduleKey="ordensServico"><WorkOrdersPage /></ProtectedRoute>}
            />
            <Route
              path="/pcm"
              element={<ProtectedRoute moduleKey="pcm"><PcmPage /></ProtectedRoute>}
            />
            <Route
              path="/relatorios"
              element={<ProtectedRoute moduleKey="relatorios"><ReportsPage /></ProtectedRoute>}
            />
            <Route
              path="/administracao"
              element={<ProtectedRoute moduleKey="administracao"><AdministrationPage /></ProtectedRoute>}
            />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  );
}
