"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

function CategoryNode({
  node,
  activeSlug,
  depth,
  fontColor,
  bgColor,
}: {
  node: Node;
  activeSlug: string | undefined;
  depth: number;
  fontColor: string;
  bgColor: string;
}) {
  const hasChildren = node.children.length > 0;
  // Auto-expand if any descendant is active
  const isDescendantActive = (n: Node): boolean =>
    n.cat.slug === activeSlug || n.children.some(isDescendantActive);
  const [open, setOpen] = useState(true);

  const isActive = node.cat.slug === activeSlug;

  return (
    <li>
      <div
        className="flex items-center gap-0.5"
        style={{ paddingLeft: depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 p-0.5 rounded transition-opacity hover:opacity-60"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-150",
                open && "rotate-90"
              )}
              style={{ opacity: 0.5 }}
            />
          </button>
        ) : (
          <span className="shrink-0 w-5" />
        )}

        <Link
          href={`/products?category=${node.cat.slug}`}
          className="flex-1 text-sm px-2 py-1.5 rounded-md transition-colors"
          style={
            isActive
              ? { backgroundColor: fontColor, color: bgColor, fontWeight: 600 }
              : { opacity: 0.75 }
          }
        >
          {node.cat.name}
        </Link>
      </div>

      {hasChildren && open && (
        <ul className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <CategoryNode
              key={child.cat.id}
              node={child}
              activeSlug={activeSlug}
              depth={depth + 1}
              fontColor={fontColor}
              bgColor={bgColor}
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
  fontColor: string;
  bgColor: string;
}

export function CategorySidebar({ categories, activeSlug, fontColor, bgColor }: CategorySidebarProps) {
  const tree = buildTree(categories);

  return (
    <nav>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ opacity: 0.5 }}>
        Categories
      </p>
      <ul className="space-y-0.5">
        <li>
          <Link
            href="/products"
            className="block text-sm px-2 py-1.5 rounded-md ml-5 transition-colors"
            style={
              !activeSlug
                ? { backgroundColor: fontColor, color: bgColor, fontWeight: 600 }
                : { opacity: 0.75 }
            }
          >
            All
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
          />
        ))}
      </ul>
    </nav>
  );
}
