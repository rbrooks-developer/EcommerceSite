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
}

export function Header({ siteTitle, logoUrl, navConfig }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const navItems = navConfig?.items ?? [];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900">
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
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/account" prefetch={false} className="p-2 text-gray-600 hover:text-gray-900" aria-label="My account">
              <User className="h-5 w-5" />
            </Link>
            <Link href="/cart" className="relative p-2 text-gray-600 hover:text-gray-900">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>
            <button
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
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
          menuOpen ? "max-h-96 border-t border-gray-100" : "max-h-0"
        )}
      >
        <nav className="flex flex-col px-4 py-3 space-y-1 bg-white">
          {navItems.map((item) => (
            <Link
              key={item.link}
              href={item.link}
              onClick={() => setMenuOpen(false)}
              className="py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/account"
            prefetch={false}
            onClick={() => setMenuOpen(false)}
            className="py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            My Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
