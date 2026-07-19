"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { deleteProduct, deleteAllProducts, togglePublished } from "@/lib/actions/products";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { formatPrice, imgUrl } from "@/lib/utils";
import type { Product } from "@/types";

type ProductRow = Product & { categories: { name: string } | null };

function usePublishToggle(id: string, initialPublished: boolean) {
  const [published, setPublished] = useState(initialPublished);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const prev = published;
    setPublished(!prev);
    setLoading(true);
    try {
      await togglePublished(id, prev);
    } catch {
      setPublished(prev);
      alert("Failed to update product status.");
    } finally {
      setLoading(false);
    }
  };

  return { published, loading, toggle };
}

export function DeleteProductButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setLoading(true);
    try {
      const result = await deleteProduct(id);
      if ("error" in result) alert(result.error);
    } catch {
      alert("Failed to delete product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-red-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1 text-sm"
    >
      {loading ? <Spinner className="h-3 w-3" /> : null}
      Delete
    </button>
  );
}

function DeleteAllModal({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl p-6 space-y-4 mx-4">
        <h2 className="text-base font-semibold text-gray-900">Delete All Products?</h2>
        <p className="text-sm text-gray-600">
          This will permanently remove every product and cannot be undone. Products tied to existing orders will be kept automatically.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Spinner className="h-4 w-4 mx-auto" /> : "Yes, Delete All"}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteAllProductsButton() {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleDeleteAll = async () => {
    setLoading(true);
    try {
      const result = await deleteAllProducts();
      if ("error" in result) {
        alert(result.error);
      } else if (result.skipped > 0) {
        alert(
          `Deleted ${result.deleted} product(s). ${result.skipped} product(s) were kept because ` +
          `they're referenced by an existing order and can't be removed without losing that order's history.`,
        );
      }
    } catch {
      alert("Failed to delete products.");
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  return (
    <>
      {showModal && (
        <DeleteAllModal
          onConfirm={handleDeleteAll}
          onClose={() => setShowModal(false)}
          loading={loading}
        />
      )}
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 h-11 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        {loading ? <Spinner className="h-4 w-4" /> : null}
        Delete All
      </button>
    </>
  );
}

export function ProductCard({ product, favoriteCount = 0 }: { product: ProductRow; favoriteCount?: number }) {
  const { published, loading, toggle } = usePublishToggle(product.id, product.is_published);
  const image = (product.images as string[])[0];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        {image && (
          <div className="relative h-16 w-16 shrink-0 rounded-md overflow-hidden">
            <Image src={imgUrl(image)} alt={product.name} fill className="object-cover" sizes="64px" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{product.name}</p>
          <p className="text-sm text-gray-500">{formatPrice(Number(product.price) * 100)}</p>
          <p className="text-xs text-gray-400">{product.categories?.name ?? "—"}</p>
          {favoriteCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">❤️ {favoriteCount} {favoriteCount === 1 ? "favorite" : "favorites"}</p>
          )}
        </div>
        <Badge variant={published ? "success" : "outline"}>{published ? "Live" : "Draft"}</Badge>
      </div>
      <div className="mt-3 flex gap-2">
        <Link href={`/admin/products/${product.id}/edit`} className="text-sm text-blue-600 hover:underline">Edit</Link>
        <button
          onClick={toggle}
          disabled={loading}
          className="text-gray-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1 text-sm"
        >
          {loading ? <Spinner className="h-3 w-3" /> : null}
          {published ? "Unpublish" : "Publish"}
        </button>
        <DeleteProductButton id={product.id} />
      </div>
    </div>
  );
}

export function ProductTableRow({ product, favoriteCount = 0 }: { product: ProductRow; favoriteCount?: number }) {
  const { published, loading, toggle } = usePublishToggle(product.id, product.is_published);
  const image = (product.images as string[])[0];

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {image ? (
            <div className="relative h-10 w-10 rounded-md overflow-hidden shrink-0">
              <Image src={imgUrl(image)} alt={product.name} fill className="object-cover" sizes="40px" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-md bg-gray-100 shrink-0" />
          )}
          <span className="font-medium text-gray-900">{product.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-500">{product.categories?.name ?? "—"}</td>
      <td className="px-4 py-3 text-gray-700">{formatPrice(Number(product.price) * 100)}</td>
      <td className="px-4 py-3 text-gray-700">{product.inventory}</td>
      <td className="px-4 py-3 text-gray-700">{favoriteCount > 0 ? favoriteCount : <span className="text-gray-300">—</span>}</td>
      <td className="px-4 py-3">
        <Badge variant={published ? "success" : "outline"}>{published ? "Live" : "Draft"}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/admin/products/${product.id}/edit`} className="text-blue-600 hover:underline">Edit</Link>
          <button
            onClick={toggle}
            disabled={loading}
            className="text-gray-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1 text-sm"
          >
            {loading ? <Spinner className="h-3 w-3" /> : null}
            {published ? "Unpublish" : "Publish"}
          </button>
          <DeleteProductButton id={product.id} />
        </div>
      </td>
    </tr>
  );
}
