"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X, ShoppingCart, CircleUser, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart/store";
import type { NavConfig } from "@/types";

interface HeaderProps {
  siteTitle: string;
  logoUrl: string | null;
  logoSpin?: boolean; // spin in the sticky header
  navConfig: NavConfig;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  bgColor?: string;
  fontColor?: string;
  approvedOffersCount?: number;
  avatarUrl?: string | null;
  striationImageUrl?: string | null;
  striationOpacity?: number;
  striationBlendMode?: React.CSSProperties["mixBlendMode"];
  striationPosition?: string;
}

// Bare anchors like "#services" become "/#services" so they always target the homepage
function resolveNavHref(link: string) {
  return link.startsWith("#") ? `/${link}` : link;
}

function isOffersLink(link: string) {
  const n = link.replace(/^\//, "");
  return n === "account#offers" || n.startsWith("account#offers");
}

function isAccountLink(link: string) {
  const n = link.startsWith("/") ? link : `/${link}`;
  return n.startsWith("/account");
}

export function Header({ siteTitle, logoUrl, logoSpin = false, navConfig, isLoggedIn, isAdmin = false, bgColor = "#ffffff", fontColor = "#111827", approvedOffersCount = 0, avatarUrl, striationImageUrl, striationOpacity = 30, striationBlendMode = "screen", striationPosition = "full" }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const navItems = navConfig?.items ?? [];

  return (
    <header
      className="sticky top-0 z-50"
      style={{ backgroundColor: bgColor, color: fontColor }}
    >
      {striationImageUrl && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: `url(${striationImageUrl})`,
            backgroundAttachment: "fixed",
            backgroundSize: striationPosition === "full" ? "cover" : striationPosition === "stretch" ? "100% 100%" : striationPosition === "contain" ? "contain" : striationPosition === "tile" ? "auto" : "auto 100%",
            backgroundPosition: striationPosition === "left" ? "left center" : striationPosition === "right" ? "right center" : "center",
            backgroundRepeat: striationPosition === "tile" ? "repeat" : "no-repeat",
            opacity: striationOpacity / 100,
            mixBlendMode: striationBlendMode,
          }}
        />
      )}
      <div style={{ position: "relative" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between pt-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg" style={{ color: fontColor }}>
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={siteTitle}
                width={200}
                height={48}
                style={{ height: "48px", width: "auto", ...(logoSpin ? { animation: "logo-spin-3d 3s linear infinite" } : {}) }}
              />
            ) : (
              siteTitle
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.filter((item) => isLoggedIn || !isAccountLink(item.link)).map((item) => {
              const showBadge = isOffersLink(item.link) && approvedOffersCount > 0;
              return (
                <Link
                  key={item.link}
                  href={resolveNavHref(item.link)}
                  className="relative text-base font-bold transition-opacity hover:opacity-70"
                  style={{ color: fontColor }}
                >
                  {item.label}
                  {showBadge && (
                    <span className="absolute -top-2 -right-4 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold" style={{ color: "white", WebkitTextFillColor: "white" }}>
                      {approvedOffersCount > 9 ? "9+" : approvedOffersCount}
                    </span>
                  )}
                </Link>
              );
            })}
            {isAdmin && (
              <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={isLoggedIn ? "/account" : "/login"}
              className="p-1 transition-opacity hover:opacity-75"
              style={{ color: fontColor }}
              aria-label={isLoggedIn ? "My account" : "Sign in"}
            >
              {isLoggedIn ? (
                <span className="relative inline-flex">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="My account"
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      style={{ border: `2px solid ${fontColor}` }}
                    />
                  ) : (
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: fontColor }}
                    >
                      <UserRound className="h-6 w-6" style={{ color: bgColor }} />
                    </span>
                  )}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500"
                    style={{ boxShadow: `0 0 0 2px ${bgColor}` }}
                  />
                </span>
              ) : (
                <CircleUser className="h-10 w-10" strokeWidth={1.5} />
              )}
            </Link>
            <Link href="/cart" className="relative p-2 transition-opacity hover:opacity-70" style={{ color: fontColor }}>
              <ShoppingCart className="h-10 w-10" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold" style={{ color: "white", WebkitTextFillColor: "white" }}>
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
      >
        <nav className="flex flex-col px-4 py-3 space-y-1">
          {navItems.filter((item) => isLoggedIn || !isAccountLink(item.link)).map((item) => {
            const showBadge = isOffersLink(item.link) && approvedOffersCount > 0;
            return (
              <Link
                key={item.link}
                href={resolveNavHref(item.link)}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: fontColor }}
              >
                {item.label}
                {showBadge && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold" style={{ color: "white", WebkitTextFillColor: "white" }}>
                    {approvedOffersCount > 9 ? "9+" : approvedOffersCount}
                  </span>
                )}
              </Link>
            );
          })}
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
      </div>
    </header>
  );
}
