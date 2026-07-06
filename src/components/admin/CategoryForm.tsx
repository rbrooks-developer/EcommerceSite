"use client";

import { useActionState, useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/utils";
import { CategorySelect, buildCategoryOptions } from "./CategorySelect";
import { Search, X, Loader2 } from "lucide-react";
import type { Category } from "@/types";

interface EbaySearchResult {
  ebay_category_id: string;
  name: string;
  category_path: string;
  is_leaf: boolean;
}

interface TariffCode { id: string; hs_tariff_number: string; description: string }

interface CategoryFormProps {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  categories: Category[];
  tariffCodes?: TariffCode[];
  defaultValues?: Partial<Category & { ebay_category_id?: string | null; ebay_category_name?: string | null }>;
  submitLabel?: string;
}

export function CategoryForm({
  action,
  categories,
  tariffCodes = [],
  defaultValues,
  submitLabel = "Save Category",
}: CategoryFormProps) {
  const [state, formAction, isPending] = useActionState(action, null) as [
    { error?: Record<string, string[]> } | null,
    (payload: FormData) => void,
    boolean
  ];

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const [parentId, setParentId] = useState(defaultValues?.parent_id ?? "");
  const [ebayCategoryId,   setEbayCategoryId]   = useState(defaultValues?.ebay_category_id   ?? "");
  const [ebayCategoryName, setEbayCategoryName] = useState(defaultValues?.ebay_category_name ?? "");
  const [ebaySearch,    setEbaySearch]    = useState("");
  const [ebayResults,   setEbayResults]   = useState<EbaySearchResult[]>([]);
  const [ebayLoading,   setEbayLoading]   = useState(false);
  const [showEbayPicker, setShowEbayPicker] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const input = nameRef.current;
    if (!input) return;
    const handler = () => {
      if (slugRef.current && !defaultValues?.slug) {
        slugRef.current.value = slugify(input.value);
      }
    };
    input.addEventListener("input", handler);
    return () => input.removeEventListener("input", handler);
  }, [defaultValues?.slug]);

  const searchEbay = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setEbayResults([]); setEbayLoading(false); return; }
    setEbayLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ebay/categories/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setEbayResults(data.categories ?? []);
      } catch {
        setEbayResults([]);
      } finally {
        setEbayLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    searchEbay(ebaySearch);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ebaySearch, searchEbay]);

  const errors = (state as { error?: Record<string, string[]> } | null)?.error;

  // Only depth 0 and 1 can be parents — selecting them creates depth 1 or 2 children,
  // and depth-2 children can themselves be parents to reach the 3-level maximum.
  const options = buildCategoryOptions(categories, {
    noneLabel: "None (top level)",
    excludeId: defaultValues?.id,
    maxDepth: 1,
  });

  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      {errors?._form && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errors._form[0]}
        </div>
      )}

      <div>
        <Label htmlFor="name" required>Name</Label>
        <Input
          ref={nameRef}
          id="name"
          name="name"
          defaultValue={defaultValues?.name}
          placeholder="e.g. Clothing"
          error={errors?.name?.[0]}
          required
        />
      </div>

      <div>
        <Label htmlFor="slug" required>Slug</Label>
        <Input
          ref={slugRef}
          id="slug"
          name="slug"
          defaultValue={defaultValues?.slug}
          placeholder="e.g. clothing"
          error={errors?.slug?.[0]}
          required
        />
        <p className="mt-1 text-xs text-gray-500">Used in URLs. Lowercase letters, numbers, and hyphens only.</p>
      </div>

      <div>
        <Label>Parent Category</Label>
        <CategorySelect
          options={options}
          value={parentId}
          onChange={setParentId}
          inputName="parent_id"
        />
      </div>

      {/* ── eBay Category ── */}
      <div>
        <Label>eBay Category</Label>
        <p className="mb-2 text-xs text-gray-500">
          Maps this store category to an eBay category for listing sync.
        </p>

        {/* Hidden inputs carry the selected values into the form */}
        <input type="hidden" name="ebay_category_id"   value={ebayCategoryId   ?? ""} />
        <input type="hidden" name="ebay_category_name" value={ebayCategoryName ?? ""} />

        {ebayCategoryId ? (
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="flex-1 text-gray-800 leading-snug">{ebayCategoryName}</span>
            <span className="shrink-0 font-mono text-xs text-gray-400">#{ebayCategoryId}</span>
            <button
              type="button"
              onClick={() => { setEbayCategoryId(""); setEbayCategoryName(""); }}
              className="ml-1 text-gray-400 hover:text-gray-600"
              aria-label="Clear eBay category"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowEbayPicker(true)}
            className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            <Search className="h-4 w-4" />
            Search eBay categories…
          </button>
        )}

        {ebayCategoryId && (
          <button
            type="button"
            onClick={() => setShowEbayPicker(true)}
            className="mt-1 text-xs text-blue-600 hover:underline"
          >
            Change
          </button>
        )}
      </div>

      {/* ── HS Tariff Number ── */}
      <div>
        <Label htmlFor="hs_tariff_number">HS Tariff Number</Label>
        <input
          id="hs_tariff_number"
          name="hs_tariff_number"
          list="tariff-codes-list"
          defaultValue={defaultValues?.hs_tariff_number ?? ""}
          placeholder="e.g. 9705.00.0000 or pick from library…"
          maxLength={20}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        {tariffCodes.length > 0 && (
          <datalist id="tariff-codes-list">
            {tariffCodes.map((tc) => (
              <option key={tc.id} value={tc.hs_tariff_number}>{tc.description}</option>
            ))}
          </datalist>
        )}
        {errors?.hs_tariff_number?.[0] && <p className="mt-1 text-xs text-red-500">{errors.hs_tariff_number[0]}</p>}
        <p className="mt-1 text-xs text-gray-500">
          {tariffCodes.length > 0
            ? "Select from your tariff code library or type a custom 6–10 digit code."
            : "6–10 digit Harmonized System code. Add codes to your library on the Customs page."}
        </p>
      </div>

      <Button type="submit" loading={isPending}>{submitLabel}</Button>

      {/* ── eBay category picker modal ── */}
      {showEbayPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) setShowEbayPicker(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden" style={{ maxHeight: "80vh" }}>
            <div className="flex items-start justify-between px-6 pt-5 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Select eBay Category</h2>
                <p className="text-sm text-gray-500">Search across all eBay US categories</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEbayPicker(false)}
                className="rounded-full p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 pb-3">
              <div className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                <Search className="h-4 w-4 text-gray-400 shrink-0" />
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  placeholder="Type at least 2 characters…"
                  value={ebaySearch}
                  onChange={e => setEbaySearch(e.target.value)}
                  onKeyDown={e => e.key === "Escape" && setShowEbayPicker(false)}
                />
                {ebaySearch && (
                  <button type="button" onClick={() => { setEbaySearch(""); setEbayResults([]); }} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 border-t border-gray-100">
              {ebayLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </div>
              )}
              {!ebayLoading && ebaySearch.trim().length < 2 && (
                <p className="py-8 text-center text-sm text-gray-400">Type at least 2 characters</p>
              )}
              {!ebayLoading && ebaySearch.trim().length >= 2 && ebayResults.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">No categories found for "{ebaySearch}"</p>
              )}
              {!ebayLoading && ebayResults.length > 0 && (
                <p className="px-6 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                  Showing top {ebayResults.length} results
                </p>
              )}
              {!ebayLoading && ebayResults.map(cat => (
                <button
                  key={cat.ebay_category_id}
                  type="button"
                  className="w-full text-left px-6 py-3 text-sm border-b border-gray-100 last:border-0 hover:bg-blue-50 flex items-start justify-between gap-4 transition-colors"
                  onClick={() => {
                    setEbayCategoryId(cat.ebay_category_id);
                    setEbayCategoryName(cat.category_path);
                    setShowEbayPicker(false);
                    setEbaySearch("");
                    setEbayResults([]);
                  }}
                >
                  <span className="leading-snug text-gray-800">{cat.category_path}</span>
                  <span className="shrink-0 font-mono text-xs text-gray-400 mt-0.5">#{cat.ebay_category_id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
