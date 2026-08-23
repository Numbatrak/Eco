import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  FileEdit,
  ShoppingCart,
  MessageSquare,
  FileText,
  UserCircle2,
  BarChart3,
  ShoppingBag,
  Archive,
  Wallet,
  Receipt,
  ScrollText,
  Calculator,
  Plug,
  Settings,
  Mail,
  Upload,
  Users,
  DollarSign,
  Calendar,
  AlertTriangle,
  Star,
  CalendarOff,
  Shuffle,
  Megaphone,
  HeartHandshake,
  Store,
  CreditCard,
  Truck,
  LineChart,
  Paintbrush,
} from "lucide-react";

export type NavPermission = {
  resource: string;
  action: string;
};

export type NavItemConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  requiredPermission: NavPermission | null;
  /** When set, user must have one of these org roles */
  requiredRoles?: string[];
  /** Hide unless user has pending invitations (accept-invitation only) */
  showWhenPendingInvitations?: boolean;
};

export type NavGroupConfig = {
  id: string;
  label: string;
  items: NavItemConfig[];
};

/** Sidebar structure per Numbatrak Developer Brief v1 §03 */
export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/",
        requiredPermission: null,
      },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    items: [
      {
        id: "orders",
        label: "Orders",
        icon: Package,
        path: "/orders",
        requiredPermission: { resource: "orders", action: "canView" },
      },
      {
        id: "order-forms",
        label: "Order Forms",
        icon: FileEdit,
        path: "/forms",
        requiredPermission: { resource: "forms", action: "canView" },
      },
      {
        id: "abandoned-carts",
        label: "Abandoned Carts",
        icon: ShoppingCart,
        path: "/abandoned-carts",
        requiredPermission: { resource: "orders", action: "canView" },
      },
      {
        id: "follow-ups",
        label: "Follow-Ups",
        icon: MessageSquare,
        path: "/follow-ups",
        requiredPermission: { resource: "orders", action: "canView" },
      },
    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    items: [
      {
        id: "waybills",
        label: "Waybills",
        icon: FileText,
        path: "/waybills",
        requiredPermission: { resource: "deliveries", action: "canView" },
      },
      {
        id: "import-waybills",
        label: "Import Waybills",
        icon: Upload,
        path: "/import",
        requiredPermission: null,
        requiredRoles: ["Manager", "Admin", "Owner"],
      },
      {
        id: "agents",
        label: "Agents",
        icon: UserCircle2,
        path: "/agents",
        requiredPermission: { resource: "agents", action: "canView" },
      },
      {
        id: "delivery-analytics",
        label: "Delivery Analytics",
        icon: BarChart3,
        path: "/delivery-analytics",
        requiredPermission: null,
        requiredRoles: ["Manager", "Admin", "Owner"],
      },
    ],
  },
  {
    id: "products",
    label: "Products",
    items: [
      {
        id: "products",
        label: "Products",
        icon: ShoppingBag,
        path: "/products",
        requiredPermission: { resource: "products", action: "canView" },
      },
      {
        id: "inventory",
        label: "Inventory",
        icon: Archive,
        path: "/inventory",
        requiredPermission: { resource: "inventory", action: "canView" },
      },
    ],
  },
  {
    id: "storefront",
    label: "Storefront",
    items: [
      {
        id: "storefront-site-settings",
        label: "Site Settings",
        icon: Store,
        path: "/storefront/site-settings",
        requiredPermission: null,
        requiredRoles: ["Admin", "Owner"],
      },
      {
        id: "storefront-payment-settings",
        label: "Payment Settings",
        icon: CreditCard,
        path: "/storefront/payment-settings",
        requiredPermission: null,
        requiredRoles: ["Admin", "Owner"],
      },
      {
        id: "storefront-delivery-settings",
        label: "Delivery Settings",
        icon: Truck,
        path: "/storefront/delivery-settings",
        requiredPermission: null,
        requiredRoles: ["Admin", "Owner"],
      },
      {
        id: "storefront-analytics-settings",
        label: "Analytics Settings",
        icon: LineChart,
        path: "/storefront/analytics-settings",
        requiredPermission: null,
        requiredRoles: ["Admin", "Owner"],
      },
      {
        id: "storefront-builder",
        label: "Builder",
        icon: Paintbrush,
        path: "/storefront/builder",
        requiredPermission: null,
        requiredRoles: ["Admin", "Owner"],
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        id: "wallet",
        label: "Wallet",
        icon: Wallet,
        path: "/wallet",
        requiredPermission: null,
        requiredRoles: ["Manager", "Admin", "Owner"],
      },
      {
        id: "expenses",
        label: "Expenses",
        icon: Receipt,
        path: "/expenses",
        requiredPermission: { resource: "generalExpenses", action: "canView" },
      },
      {
        id: "invoicing",
        label: "Invoicing",
        icon: ScrollText,
        path: "/invoicing",
        requiredPermission: null,
        requiredRoles: ["Manager", "Admin", "Owner"],
      },
      {
        id: "accounting",
        label: "Accounting",
        icon: Calculator,
        path: "/accounting",
        requiredPermission: null,
        requiredRoles: ["Manager", "Admin", "Owner"],
      },
    ],
  },
  {
    id: "staff-management",
    label: "Staff Management",
    items: [
      {
        id: "staff",
        label: "Staff",
        icon: Users,
        path: "/staff",
        requiredPermission: { resource: "staff", action: "canView" },
      },
      {
        id: "payroll",
        label: "Payroll",
        icon: DollarSign,
        path: "/payroll",
        requiredPermission: { resource: "payroll", action: "canView" },
      },
      {
        id: "attendance",
        label: "Attendance",
        icon: Calendar,
        path: "/attendance",
        requiredPermission: { resource: "attendance", action: "canView" },
      },
      {
        id: "strikes",
        label: "Strikes",
        icon: AlertTriangle,
        path: "/strikes",
        requiredPermission: { resource: "strikes", action: "canView" },
      },
      {
        id: "stars",
        label: "Stars & Leaderboard",
        icon: Star,
        path: "/stars",
        requiredPermission: { resource: "stars", action: "canView" },
      },
      {
        id: "leave",
        label: "Leave",
        icon: CalendarOff,
        path: "/leave",
        requiredPermission: { resource: "leave", action: "canView" },
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [
      {
        id: "media-buyers",
        label: "Media Buyers",
        icon: Megaphone,
        path: "/media-buyers",
        requiredPermission: { resource: "mediaBuyers", action: "canView" },
      },
      {
        id: "crm",
        label: "Customer Management",
        icon: HeartHandshake,
        path: "/crm",
        requiredPermission: { resource: "crm", action: "canView" },
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "order-assignment",
        label: "Order Assignment",
        icon: Shuffle,
        path: "/order-assignment",
        requiredPermission: { resource: "orderAssignment", action: "canView" },
      },
      {
        id: "integrations",
        label: "Integrations",
        icon: Plug,
        path: "/integrations",
        requiredPermission: null,
        requiredRoles: ["Manager", "Admin", "Owner"],
      },
      {
        id: "organization-settings",
        label: "Organization Settings",
        icon: Settings,
        path: "/organization-settings",
        requiredPermission: null,
      },
      {
        id: "accept-invitation",
        label: "Invitations",
        icon: Mail,
        path: "/accept-invitation",
        requiredPermission: null,
        showWhenPendingInvitations: true,
      },
    ],
  },
];

export function isNavPathActive(pathname: string, path: string): boolean {
  if (path === "/") {
    return pathname === "/";
  }
  if (path === "/forms") {
    return pathname === "/forms" || pathname.startsWith("/forms/");
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
