import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { ProductForm } from "@/components/admin/ProductForm";
import { updateProduct } from "@/lib/actions/products";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }, { data: tariffCodes }, settings] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("categories").select("*").order("name"),
    supabase.from("tariff_codes").select("id, hs_tariff_number, description").order("hs_tariff_number"),
    getSettings(),
  ]);

  if (!product) notFound();

  const boundAction = updateProduct.bind(null, id);
  const maxSizeMb = (settings as any)?.max_image_size_mb ?? 2;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/admin/products" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
      </div>
      <ProductForm
        action={boundAction}
        categories={categories ?? []}
        tariffCodes={tariffCodes ?? []}
        defaultValues={product}
        submitLabel="Save Changes"
        maxSizeMb={maxSizeMb}
      />
    </div>
  );
}
