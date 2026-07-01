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
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2"
          style={{
            borderColor: "var(--site-fg, #111827)",
            backgroundColor: "transparent",
            color: "var(--site-fg, #111827)",
            opacity: 0.85,
          }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 sm:w-44"
          style={{
            borderColor: "var(--site-fg, #111827)",
            backgroundColor: "var(--site-bg, #ffffff)",
            color: "var(--site-fg, #111827)",
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
