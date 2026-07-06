import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { updateCategory } from "@/lib/actions/categories";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: category }, { data: categories }, { data: tariffCodes }] = await Promise.all([
    supabase.from("categories").select("*").eq("id", id).single(),
    supabase.from("categories").select("*").order("name"),
    supabase.from("tariff_codes").select("id, hs_tariff_number, description").order("hs_tariff_number"),
  ]);

  if (!category) notFound();

  const boundAction = updateCategory.bind(null, id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/admin/categories" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Category</h1>
      </div>
      <CategoryForm
        action={boundAction}
        categories={categories ?? []}
        tariffCodes={tariffCodes ?? []}
        defaultValues={category}
        submitLabel="Save Changes"
      />
    </div>
  );
}
