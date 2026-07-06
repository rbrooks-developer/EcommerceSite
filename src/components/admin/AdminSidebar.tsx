"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/actions/auth";
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  ShoppingCart,
  Settings,
  Tag,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  RefreshCw,
  Bell,
  BarChart2,
  Globe,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { label: "Dashboard",     href: "/admin",                 icon: LayoutDashboard, exact: true },
  { label: "Products",      href: "/admin/products",        icon: Package },
  { label: "Categories",    href: "/admin/categories",      icon: FolderOpen },
  { label: "Orders",        href: "/admin/orders",          icon: ShoppingCart },
  { label: "Offers",        href: "/admin/offers",          icon: Tag },
  { label: "eBay Sync",        href: "/admin/ebay",            icon: RefreshCw },
  { label: "Google Analytics", href: "/admin/analytics",      icon: BarChart2 },
  { label: "Customs",           href: "/admin/customs",        icon: Globe },
  { label: "Notifications",    href: "/admin/notifications",  icon: Bell },
  { label: "Settings",         href: "/admin/settings",       icon: Settings },
];

function NavLink({ item, unreadCount, onClick }: { item: typeof navItems[0]; unreadCount?: number; onClick?: () => void }) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-gray-900 text-white dark:bg-indigo-600 dark:text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
      {unreadCount != null && unreadCount > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({ onClose, unreadNotifications, pendingOffers, isDark }: { onClose?: () => void; unreadNotifications?: number; pendingOffers?: number; isDark?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-gray-200 dark:border-gray-700 px-4">
        <span className="text-lg font-bold text-gray-900 dark:text-gray-50">Admin</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto lg:hidden p-1 rounded-md hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            onClick={onClose}
            unreadCount={
              item.href === "/admin/notifications" ? unreadNotifications :
              item.href === "/admin/offers"        ? pendingOffers :
              undefined
            }
          />
        ))}
      </nav>
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-1">
        <ThemeToggle isDark={isDark ?? false} />
        <Link
          href="/"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to Website
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminSidebar({ unreadNotifications, pendingOffers, isDark }: { unreadNotifications?: number; pendingOffers?: number; isDark?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header bar */}
      <div className="flex h-16 items-center border-b bg-white dark:bg-gray-900 dark:border-gray-700 px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-3 text-lg font-bold">Admin</span>
        {unreadNotifications != null && unreadNotifications > 0 && (
          <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unreadNotifications > 99 ? "99+" : unreadNotifications}
          </span>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-in */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 shadow-xl transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} unreadNotifications={unreadNotifications} pendingOffers={pendingOffers} isDark={isDark} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-white dark:bg-gray-900 dark:border-gray-700">
        <SidebarContent unreadNotifications={unreadNotifications} pendingOffers={pendingOffers} isDark={isDark} />
      </div>
    </>
  );
}
