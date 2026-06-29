"use client";

import { useState } from "react";
import { deleteProduct, deleteAllProducts, togglePublished } from "@/lib/actions/products";
import { Spinner } from "@/components/ui/spinner";

export function DeleteProductButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setLoading(true);
    try {
      await deleteProduct(id);
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

export function DeleteAllProductsButton() {
  const [loading, setLoading] = useState(false);

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL products? This will permanently remove every product and cannot be undone.")) return;
    if (!confirm("Are you sure? This cannot be reversed.")) return;
    setLoading(true);
    try {
      await deleteAllProducts();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDeleteAll}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 h-11 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      Delete All
    </button>
  );
}

export function TogglePublishedButton({ id, isPublished }: { id: string; isPublished: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    await togglePublished(id, isPublished);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="text-gray-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1 text-sm"
    >
      {loading ? <Spinner className="h-3 w-3" /> : null}
      {isPublished ? "Unpublish" : "Publish"}
    </button>
  );
}
