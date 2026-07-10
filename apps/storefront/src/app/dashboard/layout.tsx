import type { ReactNode } from "react";
import "./dashboard-theme.css";
import { AuthProvider } from "../../components/dashboard/AuthContext";

export const metadata = {
  title: "Dashboard",
};

export default function DashboardRootLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return <AuthProvider>{children}</AuthProvider>;
}
