"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart/store";
import type { NavConfig } from "@/types";

interface HeaderProps {
  siteTitle: string;
  logoUrl: string | null;
  navConfig: NavConfig;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  bgColor?: string;
  fontColor?: string;
}

export function Header({ siteTitle, logoUrl, navConfig, isLoggedIn, isAdmin = false, bgColor = "#ffffff", fontColor = "#111827" }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const navItems = navConfig?.items ?? [];

  return (
    <header
      className="sticky top-0 z-30 border-b border-black/10"
      style={{ backgroundColor: bgColor, color: fontColor }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg" style={{ color: fontColor }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={siteTitle} className="h-8 w-auto" />
            ) : (
              siteTitle
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.link}
                href={item.link}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: fontColor }}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link href={isLoggedIn ? "/account" : "/login"} className="p-2 transition-opacity hover:opacity-70" style={{ color: fontColor }} aria-label={isLoggedIn ? "My account" : "Sign in"}>
              <User className="h-5 w-5" />
            </Link>
            <Link href="/cart" className="relative p-2 transition-opacity hover:opacity-70" style={{ color: fontColor }}>
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>
            <button
              className="md:hidden p-2 transition-opacity hover:opacity-70"
              style={{ color: fontColor }}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-200",
          menuOpen ? "max-h-96 border-t border-black/10" : "max-h-0"
        )}
        style={{ backgroundColor: bgColor }}
      >
        <nav className="flex flex-col px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.link}
              href={item.link}
              onClick={() => setMenuOpen(false)}
              className="py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: fontColor }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={isLoggedIn ? "/account" : "/login"}
            onClick={() => setMenuOpen(false)}
            className="py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: fontColor }}
          >
            {isLoggedIn ? "My Account" : "Sign in"}
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="py-2.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
