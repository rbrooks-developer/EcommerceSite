import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { ProductImages } from "./ProductImages";
import { AddToCartButton } from "@/components/storefront/AddToCartButton";
import { MakeOfferForm } from "./MakeOfferForm";
import type { Metadata } from "next";
import type { Product } from "@/types";

type ProductWithCategory = Product & {
  categories: { name: string; slug: string } | null;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("name, seo_title, seo_description, images")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return {};
  const product = data as Pick<Product, "name" | "seo_title" | "seo_description" | "images">;
  const settings = await getSettings();
  return {
    title: product.seo_title ?? `${product.name} | ${settings?.site_title ?? "Store"}`,
    description: product.seo_description ?? undefined,
    openGraph: {
      title: product.seo_title ?? product.name,
      description: product.seo_description ?? undefined,
      images: (product.images as string[]).slice(0, 1),
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("products")
    .select("*, categories(name, slug)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!data) notFound();
  const product = data as ProductWithCategory;
  const images = product.images as string[];

  // Check if user has a recent offer on this product (pending/approved blocks new offer; declined shows notice but allows retry)
  let existingOfferStatus: string | null = null;
  let existingDeclineReason: string | null = null;
  if (user && product.inventory > 0) {
    const { data: existingOffer } = await supabase
      .from("product_offers")
      .select("status, decline_reason")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .in("status", ["pending", "approved", "declined"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const offer = existingOffer as { status: string; decline_reason: string | null } | null;
    existingOfferStatus = offer?.status ?? null;
    existingDeclineReason = offer?.decline_reason ?? null;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: images,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "USD",
      availability: product.inventory > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="lg:w-1/2">
            <ProductImages images={images} name={product.name} />
          </div>

          <div className="lg:w-1/2 space-y-5">
            {product.categories && (
              <p className="text-xs uppercase tracking-widest" style={{ opacity: 0.5 }}>
                {product.categories.name}
              </p>
            )}
            <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
            <p className="text-2xl font-semibold">{formatPrice(Number(product.price) * 100)}</p>

            {product.description && (
              <p className="text-sm leading-relaxed" style={{ opacity: 0.7 }}>{product.description}</p>
            )}

            <AddToCartButton product={product} />
            {product.inventory > 0 && user && (
              <MakeOfferForm
                productId={product.id}
                listPrice={Number(product.price)}
                maxQuantity={product.inventory}
                existingStatus={existingOfferStatus}
                existingDeclineReason={existingDeclineReason}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
