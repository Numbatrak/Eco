import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { RequireAuth, RequireGuest } from "./components/RouteGuards";
import DashboardLayout from "./components/DashboardLayout";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import TwoFactorVerifyPage from "./pages/auth/TwoFactorVerifyPage";
import DashboardPage from "./pages/DashboardPage";
import SecuritySettingsPage from "./pages/security/SecuritySettingsPage";
import ProductsListPage from "./pages/products/ProductsListPage";
import ProductFormPage from "./pages/products/ProductFormPage";
import OrdersListPage from "./pages/orders/OrdersListPage";
import OrderDetailPage from "./pages/orders/OrderDetailPage";
import PaymentSettingsPage from "./pages/payments/PaymentSettingsPage";
import SiteSettingsPage from "./pages/site/SiteSettingsPage";

export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RequireGuest />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/2fa/verify" element={<TwoFactorVerifyPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsListPage />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:productId" element={<ProductFormPage />} />
              <Route path="/orders" element={<OrdersListPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
              <Route path="/payment-settings" element={<PaymentSettingsPage />} />
              <Route path="/site-settings" element={<SiteSettingsPage />} />
              <Route path="/security" element={<SecuritySettingsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
