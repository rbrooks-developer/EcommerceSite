"use client";

import { useState, useMemo } from "react";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/types";

type ProductRow = Pick<Product, "id" | "slug" | "name" | "price" | "images" | "inventory">;

type SortKey = "az" | "za" | "price_asc" | "price_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "az",         label: "A → Z" },
  { value: "za",         label: "Z → A" },
  { value: "price_asc",  label: "Lowest Price" },
  { value: "price_desc", label: "Highest Price" },
];

export function CategoryProducts({ products }: { products: ProductRow[] }) {
  const [query, setQuery]   = useState("");
  const [sort, setSort]     = useState<SortKey>("az");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : [...products];

    switch (sort) {
      case "az":         list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "za":         list.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "price_asc":  list.sort((a, b) => Number(a.price) - Number(b.price)); break;
      case "price_desc": list.sort((a, b) => Number(b.price) - Number(a.price)); break;
    }

    return list;
  }, [products, query, sort]);

  return (
    <>
      <div
        className="flex flex-col sm:flex-row gap-3 mb-6 px-4 sm:px-0"
        style={{ position: "relative", zIndex: 46 }}
      >
        <input
          type="search"
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            borderRadius: "0.5rem",
            border: "1px solid var(--site-fg, #111827)",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            backgroundColor: "var(--site-bg, #ffffff)",
            color: "var(--site-fg, #111827)",
            outline: "none",
          }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            borderRadius: "0.5rem",
            border: "1px solid var(--site-fg, #111827)",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            backgroundColor: "var(--site-bg, #ffffff)",
            color: "var(--site-fg, #111827)",
            width: "11rem",
            outline: "none",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-20" style={{ opacity: 0.4 }}>
          {query ? `No products matching "${query}".` : "No products in this category yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-y-8 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
