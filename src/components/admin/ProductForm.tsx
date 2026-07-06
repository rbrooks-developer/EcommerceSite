"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { slugify } from "@/lib/utils";
import { CategorySelect, buildCategoryOptions } from "./CategorySelect";
import type { Category, Product } from "@/types";

interface TariffCode { id: string; hs_tariff_number: string; description: string }

interface ProductFormProps {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  categories: Category[];
  tariffCodes?: TariffCode[];
  defaultValues?: Partial<Product>;
  submitLabel?: string;
}

export function ProductForm({
  action,
  categories,
  tariffCodes = [],
  defaultValues,
  submitLabel = "Save Product",
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, null) as [
    { error?: Record<string, string[]> } | null,
    (payload: FormData) => void,
    boolean
  ];

  const [images, setImages] = useState<string[]>(
    (defaultValues?.images as string[]) ?? []
  );
  const [isPublished, setIsPublished] = useState(defaultValues?.is_published ?? true);
  const [categoryId, setCategoryId] = useState(defaultValues?.category_id ?? "");

  const categoryOptions = buildCategoryOptions(categories, { noneLabel: "No category" });

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

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

  const errors = (state as { error?: Record<string, string[]> } | null)?.error;

  const wrappedAction = (formData: FormData) => {
    formData.set("images", JSON.stringify(images));
    formData.set("is_published", String(isPublished));
    formAction(formData);
  };

  return (
    <form action={wrappedAction} className="space-y-6 max-w-2xl">
      {errors?._form && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errors._form[0]}
        </div>
      )}

      {/* Images */}
      <div>
        <Label>Product Images</Label>
        <ImageUpload value={images} onChange={setImages} max={10} />
      </div>

      {/* Name + Slug */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name" required>Name</Label>
          <Input ref={nameRef} id="name" name="name" defaultValue={defaultValues?.name} placeholder="Product name" error={errors?.name?.[0]} required />
        </div>
        <div>
          <Label htmlFor="slug" required>Slug</Label>
          <Input ref={slugRef} id="slug" name="slug" defaultValue={defaultValues?.slug} placeholder="product-slug" error={errors?.slug?.[0]} required />
        </div>
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={defaultValues?.description ?? ""} placeholder="Describe the product..." rows={4} error={errors?.description?.[0]} />
      </div>

      {/* Price + Cost + Inventory + Category */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <Label htmlFor="price" required>Price ($)</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={defaultValues?.price} placeholder="0.00" error={errors?.price?.[0]} required />
        </div>
        <div>
          <Label htmlFor="cost">Cost ($)</Label>
          <Input id="cost" name="cost" type="number" step="0.01" min="0" defaultValue={defaultValues?.cost ?? ""} placeholder="0.00" error={errors?.cost?.[0]} />
        </div>
        <div>
          <Label htmlFor="inventory" required>Inventory</Label>
          <Input id="inventory" name="inventory" type="number" min="0" step="1" defaultValue={defaultValues?.inventory ?? 0} error={errors?.inventory?.[0]} required />
        </div>
        <div>
          <Label>Category</Label>
          <CategorySelect
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            inputName="category_id"
          />
        </div>
      </div>

      {/* Shipping: Weight + Dimensions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Shipping (required for rate calculation)</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div>
            <Label htmlFor="weight_lbs" required>Weight (lbs)</Label>
            <Input
              id="weight_lbs"
              name="weight_lbs"
              type="number"
              step="1"
              min="0"
              defaultValue={defaultValues?.weight_oz != null ? Math.floor(Number(defaultValues.weight_oz) / 16) : ""}
              placeholder="0"
              error={errors?.weight_oz?.[0]}
              required
            />
          </div>
          <div>
            <Label htmlFor="weight_oz" required>oz</Label>
            <Input
              id="weight_oz"
              name="weight_oz"
              type="number"
              step="0.1"
              min="0"
              max="15.9"
              defaultValue={defaultValues?.weight_oz != null ? Number((Number(defaultValues.weight_oz) % 16).toFixed(1)) : ""}
              placeholder="0.0"
            />
          </div>
          <div>
            <Label htmlFor="length_in">Length (in)</Label>
            <Input id="length_in" name="length_in" type="number" step="0.1" min="0.1" defaultValue={defaultValues?.length_in ?? ""} placeholder="0.0" error={errors?.length_in?.[0]} />
          </div>
          <div>
            <Label htmlFor="width_in">Width (in)</Label>
            <Input id="width_in" name="width_in" type="number" step="0.1" min="0.1" defaultValue={defaultValues?.width_in ?? ""} placeholder="0.0" error={errors?.width_in?.[0]} />
          </div>
          <div>
            <Label htmlFor="height_in">Height (in)</Label>
            <Input id="height_in" name="height_in" type="number" step="0.1" min="0.1" defaultValue={defaultValues?.height_in ?? ""} placeholder="0.0" error={errors?.height_in?.[0]} />
          </div>
        </div>
      </div>

      {/* HS Tariff Number */}
      <div>
        <Label htmlFor="hs_tariff_number">HS Tariff Number <span className="text-gray-400 font-normal">(optional)</span></Label>
        <input
          id="hs_tariff_number"
          name="hs_tariff_number"
          list="tariff-codes-list-product"
          defaultValue={(defaultValues as any)?.hs_tariff_number ?? ""}
          placeholder={tariffCodes.length > 0 ? "Pick from library or type a code…" : "e.g. 9705.00.0000"}
          maxLength={20}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        {tariffCodes.length > 0 && (
          <datalist id="tariff-codes-list-product">
            {tariffCodes.map((tc) => (
              <option key={tc.id} value={tc.hs_tariff_number}>{tc.description}</option>
            ))}
          </datalist>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Overrides the category HS code on international customs forms. Leave blank to inherit from the category or store default.
        </p>
      </div>

      {/* SEO */}
      <div className="space-y-4 rounded-md border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">SEO</h3>
        <div>
          <Label htmlFor="seo_title">Meta Title <span className="text-gray-400 font-normal">(max 60 chars)</span></Label>
          <Input id="seo_title" name="seo_title" maxLength={60} defaultValue={defaultValues?.seo_title ?? ""} placeholder="Leave blank to use product name" error={errors?.seo_title?.[0]} />
        </div>
        <div>
          <Label htmlFor="seo_description">Meta Description <span className="text-gray-400 font-normal">(max 160 chars)</span></Label>
          <Textarea id="seo_description" name="seo_description" maxLength={160} rows={2} defaultValue={defaultValues?.seo_description ?? ""} placeholder="Brief description for search engines" error={errors?.seo_description?.[0]} />
        </div>
      </div>

      {/* Published toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isPublished}
          onClick={() => setIsPublished((p) => !p)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublished ? "bg-gray-900 dark:bg-emerald-500" : "bg-gray-200 dark:bg-gray-600"}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isPublished ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <Label className="mb-0">Published</Label>
      </div>

      <Button type="submit" size="lg" loading={isPending}>{submitLabel}</Button>
    </form>
  );
}
