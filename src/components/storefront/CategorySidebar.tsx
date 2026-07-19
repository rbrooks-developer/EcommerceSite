"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarStyle, SidebarFontSize } from "@/types";

type Cat = { id: string; slug: string; name: string; parent_id: string | null };

interface Node {
  cat: Cat;
  children: Node[];
}

function buildTree(cats: Cat[]): Node[] {
  const map = new Map<string, Node>();
  cats.forEach((c) => map.set(c.id, { cat: c, children: [] }));
  const roots: Node[] = [];
  cats.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(map.get(c.id)!);
    } else if (!c.parent_id) {
      roots.push(map.get(c.id)!);
    }
  });
  return roots;
}

function nodeHasProducts(node: Node, withProducts: Set<string>): boolean {
  if (withProducts.has(node.cat.id)) return true;
  return node.children.some((child) => nodeHasProducts(child, withProducts));
}

const FROSTED_CARD: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "0.5rem",
  padding: "0.375rem",
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

function GlowBar({ fontColor }: { fontColor: string }) {
  return (
    <span
      style={{
        position: "absolute",
        left: 0,
        top: "4px",
        bottom: "4px",
        width: "3px",
        borderRadius: "0 2px 2px 0",
        backgroundColor: fontColor,
        boxShadow: `0 0 8px ${fontColor}, 0 0 16px ${fontColor}80`,
        pointerEvents: "none",
      }}
    />
  );
}

function CountBadge({
  count,
  isActive,
  fontColor,
  bgColor,
}: {
  count: number;
  isActive: boolean;
  fontColor: string;
  bgColor: string;
}) {
  if (!count) return null;
  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 600,
        padding: "0 0.4rem",
        borderRadius: "9999px",
        backgroundColor: isActive ? `${bgColor}40` : `${fontColor}22`,
        color: isActive ? bgColor : fontColor,
        minWidth: "1.4rem",
        textAlign: "center",
        lineHeight: "1.4rem",
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

const FONT_SIZE_CLASS: Record<SidebarFontSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

function CategoryNode({
  node,
  activeSlug,
  depth,
  fontColor,
  bgColor,
  withProducts,
  sidebarStyle,
  categoryCountMap,
  itemOpacity,
  fontSizeClass,
}: {
  node: Node;
  activeSlug: string | undefined;
  depth: number;
  fontColor: string;
  bgColor: string;
  withProducts: Set<string>;
  sidebarStyle: SidebarStyle;
  categoryCountMap: Record<string, number>;
  itemOpacity: number;
  fontSizeClass: string;
}) {
  if (depth > 0 && !nodeHasProducts(node, withProducts)) return null;

  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(true);
  const isActive = node.cat.slug === activeSlug;
  const count = categoryCountMap[node.cat.id] ?? 0;

  // ── link style ──────────────────────────────────────────────────────────────
  let linkStyle: React.CSSProperties;
  if (sidebarStyle === "glow-bar") {
    linkStyle = isActive
      ? { color: fontColor, fontWeight: 600, background: `linear-gradient(to right, ${fontColor}22, transparent)`, borderRadius: "0 0.375rem 0.375rem 0" }
      : { opacity: itemOpacity };
  } else if (sidebarStyle === "frosted-cards") {
    linkStyle = isActive
      ? { color: fontColor, fontWeight: 700, backgroundColor: `${fontColor}1a`, borderRadius: "0.375rem" }
      : { opacity: itemOpacity };
  } else {
    linkStyle = isActive
      ? { backgroundColor: fontColor, color: bgColor, fontWeight: 600 }
      : { opacity: itemOpacity };
  }

  // ── li container style ───────────────────────────────────────────────────────
  let liStyle: React.CSSProperties = {};
  if (sidebarStyle === "glow-bar") {
    liStyle = { position: "relative" };
  } else if (sidebarStyle === "frosted-cards" && depth === 0) {
    liStyle = FROSTED_CARD;
  }

  const linkClass = cn(
    `flex-1 ${fontSizeClass} px-2 py-1.5 transition-colors`,
    sidebarStyle === "pill" ? "rounded-full" : "rounded-md",
    sidebarStyle === "count-badges" && "flex items-center justify-between gap-2",
  );

  const paddingLeft = sidebarStyle === "glow-bar" ? depth * 14 + 6 : depth * 14;

  return (
    <li style={liStyle}>
      {sidebarStyle === "glow-bar" && isActive && <GlowBar fontColor={fontColor} />}

      <div className="flex items-center gap-0.5" style={{ paddingLeft }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 p-0.5 rounded transition-opacity hover:opacity-60"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform duration-150", open && "rotate-90")}
              style={{ opacity: 0.5 }}
            />
          </button>
        ) : (
          <span className="shrink-0 w-5" />
        )}

        <Link href={`/category/${node.cat.slug}`} className={linkClass} style={linkStyle}>
          <span>{node.cat.name}</span>
          {sidebarStyle === "count-badges" && (
            <CountBadge count={count} isActive={isActive} fontColor={fontColor} bgColor={bgColor} />
          )}
        </Link>
      </div>

      {hasChildren && open && (
        <ul
          className="mt-0.5 space-y-0.5"
          style={
            sidebarStyle === "frosted-cards" && depth === 0
              ? { borderLeft: "1px solid rgba(255,255,255,0.12)", marginLeft: "0.5rem", paddingLeft: "0.5rem", marginTop: "0.25rem" }
              : {}
          }
        >
          {node.children.map((child) => (
            <CategoryNode
              key={child.cat.id}
              node={child}
              activeSlug={activeSlug}
              depth={depth + 1}
              fontColor={fontColor}
              bgColor={bgColor}
              withProducts={withProducts}
              sidebarStyle={sidebarStyle}
              categoryCountMap={categoryCountMap}
              itemOpacity={itemOpacity}
              fontSizeClass={fontSizeClass}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface CategorySidebarProps {
  categories: Cat[];
  activeSlug: string | undefined;
  activePage?: "favorites";
  fontColor: string;
  bgColor: string;
  categoryIdsWithProducts: Set<string>;
  isLoggedIn?: boolean;
  sidebarStyle?: SidebarStyle;
  categoryCountMap?: Record<string, number>;
  totalProductCount?: number;
  sidebarItemOpacity?: number;
  sidebarFontSize?: SidebarFontSize;
}

export function CategorySidebar({
  categories,
  activeSlug,
  activePage,
  fontColor,
  bgColor,
  categoryIdsWithProducts,
  isLoggedIn = false,
  sidebarStyle = "standard",
  categoryCountMap = {},
  totalProductCount,
  sidebarItemOpacity = 0.75,
  sidebarFontSize = "sm",
}: CategorySidebarProps) {
  const tree = buildTree(categories);
  const allActive = !activeSlug && activePage !== "favorites";
  const favActive = activePage === "favorites";
  const fontSizeClass = FONT_SIZE_CLASS[sidebarFontSize] ?? "text-sm";
  const isFrosted = sidebarStyle === "frosted-cards";

  // Shared link style for "All" and "My Favorites"
  function sharedLinkStyle(isActive: boolean): React.CSSProperties {
    if (sidebarStyle === "glow-bar") {
      return isActive
        ? { color: fontColor, fontWeight: 600, background: `linear-gradient(to right, ${fontColor}22, transparent)`, borderRadius: "0 0.375rem 0.375rem 0" }
        : { opacity: sidebarItemOpacity };
    }
    if (sidebarStyle === "frosted-cards") {
      return isActive
        ? { color: fontColor, fontWeight: 700, backgroundColor: `${fontColor}1a`, borderRadius: "0.375rem" }
        : { opacity: sidebarItemOpacity };
    }
    return isActive
      ? { backgroundColor: fontColor, color: bgColor, fontWeight: 600 }
      : { opacity: sidebarItemOpacity };
  }

  const roundedClass = sidebarStyle === "pill" ? "rounded-full" : "rounded-md";
  const listClass = isFrosted ? "space-y-2" : "space-y-0.5";

  // "All" and "My Favorites" use ml-5 only when NOT in frosted-cards
  // (frosted-cards: each is its own card so no indent needed)
  const allLinkClass = cn(
    `${fontSizeClass} px-2 py-1.5 transition-colors`,
    roundedClass,
    !isFrosted && "ml-5",
    sidebarStyle === "count-badges" ? "flex items-center justify-between gap-2" : "block",
  );

  const favLinkClass = cn(
    `flex items-center gap-2 ${fontSizeClass} px-2 py-1.5 transition-colors`,
    roundedClass,
    !isFrosted && "ml-5",
  );

  return (
    <nav>
      <p className={`${fontSizeClass === "text-xs" ? "text-xs" : "text-xs"} font-semibold uppercase tracking-wider mb-3`} style={{ opacity: 0.5 }}>
        Categories
      </p>
      <ul className={listClass}>

        {/* All */}
        <li
          style={{
            ...(sidebarStyle === "glow-bar" ? { position: "relative" } : {}),
            ...(isFrosted ? FROSTED_CARD : {}),
          }}
        >
          {sidebarStyle === "glow-bar" && allActive && <GlowBar fontColor={fontColor} />}
          <Link href="/products" className={allLinkClass} style={sharedLinkStyle(allActive)}>
            <span>All</span>
            {sidebarStyle === "count-badges" && totalProductCount != null && (
              <CountBadge count={totalProductCount} isActive={allActive} fontColor={fontColor} bgColor={bgColor} />
            )}
          </Link>
        </li>

        {tree.map((node) => (
          <CategoryNode
            key={node.cat.id}
            node={node}
            activeSlug={activeSlug}
            depth={0}
            fontColor={fontColor}
            bgColor={bgColor}
            withProducts={categoryIdsWithProducts}
            sidebarStyle={sidebarStyle}
            categoryCountMap={categoryCountMap}
            itemOpacity={sidebarItemOpacity}
            fontSizeClass={fontSizeClass}
          />
        ))}

        {isLoggedIn && (
          <li
            style={{
              ...(isFrosted
                ? FROSTED_CARD
                : { borderTop: "1px solid rgba(0,0,0,0.1)", marginTop: "0.75rem", paddingTop: "0.75rem" }),
              ...(sidebarStyle === "glow-bar" ? { position: "relative" } : {}),
            }}
          >
            {sidebarStyle === "glow-bar" && favActive && <GlowBar fontColor={fontColor} />}
            <Link href="/favorites" className={favLinkClass} style={sharedLinkStyle(favActive)}>
              <Heart
                style={{
                  width: "0.875rem",
                  height: "0.875rem",
                  flexShrink: 0,
                  fill: favActive ? "#ef4444" : "none",
                  color: favActive ? "#ef4444" : "currentColor",
                }}
              />
              My Favorites
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
