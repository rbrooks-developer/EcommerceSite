import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import { DeleteCategoryButton } from "./CategoryActions";
import type { Category } from "@/types";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: raw } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  const categories = (raw ?? []) as Category[];

  const roots = categories.filter((c) => !c.parent_id);
  const children = categories.filter((c) => c.parent_id);
  const grandchildren = children.filter((c) =>
    children.some((p) => p.id === c.parent_id)
  );

  function getChildren(parentId: string) {
    return children.filter((c) => c.parent_id === parentId);
  }

  function getGrandchildren(parentId: string) {
    return grandchildren.filter((c) => c.parent_id === parentId);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <Link
          href="/admin/categories/new"
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 h-11 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Category
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-700">
        {roots.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No categories yet.</p>
        )}
        {roots.map((root) => (
          <div key={root.id} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{root.name}</span>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/admin/categories/${root.id}/edit`} className="text-blue-600 hover:underline">Edit</Link>
                <DeleteCategoryButton id={root.id} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              /{root.slug}
              {root.hs_tariff_number && <span className="ml-2 font-mono text-gray-400">HS: {root.hs_tariff_number}</span>}
            </p>

            {getChildren(root.id).map((child) => (
              <div key={child.id} className="ml-6 mt-3 border-l-2 border-gray-100 pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{child.name}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <Link href={`/admin/categories/${child.id}/edit`} className="text-blue-600 hover:underline">Edit</Link>
                    <DeleteCategoryButton id={child.id} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  /{child.slug}
                  {child.hs_tariff_number && <span className="ml-2 font-mono text-gray-400">HS: {child.hs_tariff_number}</span>}
                </p>

                {getGrandchildren(child.id).map((grand) => (
                  <div key={grand.id} className="ml-6 mt-2 border-l-2 border-gray-100 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{grand.name}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <Link href={`/admin/categories/${grand.id}/edit`} className="text-blue-600 hover:underline">Edit</Link>
                        <DeleteCategoryButton id={grand.id} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      /{grand.slug}
                      {grand.hs_tariff_number && <span className="ml-2 font-mono text-gray-400">HS: {grand.hs_tariff_number}</span>}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
