import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PlatformAdminAuthProvider } from "./platform-admin/context/PlatformAdminAuthContext";
import {
  RequirePlatformAdminAuth,
  RequirePlatformAdminGuest,
} from "./platform-admin/components/PlatformAdminRouteGuards";
import PlatformAdminLayout from "./platform-admin/components/PlatformAdminLayout";
import PlatformAdminLoginPage from "./platform-admin/pages/PlatformAdminLoginPage";
import PlatformAdminTwoFactorVerifyPage from "./platform-admin/pages/PlatformAdminTwoFactorVerifyPage";
import OverviewPage from "./platform-admin/pages/OverviewPage";
import TenantDetailPage from "./platform-admin/pages/TenantDetailPage";
import ConfigPage from "./platform-admin/pages/ConfigPage";

export default function App(): React.ReactElement {
  return (
    <PlatformAdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RequirePlatformAdminGuest />}>
            <Route path="/login" element={<PlatformAdminLoginPage />} />
          </Route>

          <Route path="/2fa/verify" element={<PlatformAdminTwoFactorVerifyPage />} />

          <Route element={<RequirePlatformAdminAuth />}>
            <Route element={<PlatformAdminLayout />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/tenants/:tenantId" element={<TenantDetailPage />} />
              <Route path="/config" element={<ConfigPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PlatformAdminAuthProvider>
  );
}
