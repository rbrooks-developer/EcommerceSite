import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { notFound } from "next/navigation";
import { formatPrice, ogImageUrl } from "@/lib/utils";
import { ProductImages } from "./ProductImages";
import { AddToCartButton } from "@/components/storefront/AddToCartButton";
import { FavoriteButton } from "@/components/storefront/FavoriteButton";
import { MakeOfferForm } from "./MakeOfferForm";
import { Breadcrumbs } from "@/components/storefront/Breadcrumbs";
import type { Metadata } from "next";
import type { Product } from "@/types";

type CategoryNode = {
  name: string;
  slug: string;
  parent: { name: string; slug: string; parent: { name: string; slug: string } | null } | null;
};

type ProductWithCategory = Product & {
  categories: CategoryNode | null;
};

// Shared within a single request so generateMetadata and the page component
// make one DB round-trip instead of two.
const getProductBySlug = cache(async (slug: string): Promise<ProductWithCategory | null> => {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name, slug, parent:parent_id(name, slug, parent:parent_id(name, slug)))")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data as ProductWithCategory | null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!product) return {};
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const title = product.seo_title || `${product.name} | ${settings?.site_title ?? "Store"}`;
  const description = product.seo_description || undefined;
  return {
    title,
    description,
    alternates: { canonical: `${appUrl}/products/${slug}` },
    openGraph: {
      type: "website",
      url: `${appUrl}/products/${slug}`,
      title: product.seo_title || product.name,
      description,
      images: (product.images as string[]).slice(0, 1).map(ogImageUrl),
    },
  };
}

function renderWithEmojiColor(text: string) {
  return text.split(/([^\x00-\x7F]+)/).map((seg, i) =>
    /[^\x00-\x7F]/.test(seg)
      ? (
        <span
          key={i}
          style={{
            WebkitTextFillColor: "initial",
            backgroundImage: "none",
            WebkitBackgroundClip: "initial",
            backgroundClip: "initial",
            fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', emoji, sans-serif",
          }}
        >
          {seg}
        </span>
      )
      : seg
  );
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [product, settings, supabase] = await Promise.all([
    getProductBySlug(slug),
    getSettings(),
    createClient(),
  ]);

  if (!product) notFound();
  const images = product.images as string[];

  const { data: { user } } = await supabase.auth.getUser();

  let isFavorited = false;
  if (user) {
    const { data: favRow } = await supabase
      .from("product_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();
    isFavorited = !!favRow;
  }

  const MAX_OFFERS = 4;
  let existingOfferStatus: string | null = null;
  let existingDeclineReason: string | null = null;
  let offersUsed = 0;

  if (user && product.inventory > 0) {
    const { data: offerRows } = await supabase
      .from("product_offers")
      .select("status, decline_reason, user_counter_count")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .in("status", ["pending", "approved", "countered", "declined", "purchased", "out_of_stock"])
      .order("created_at", { ascending: false });

    const rows = (offerRows ?? []) as { status: string; decline_reason: string | null; user_counter_count: number | null }[];
    offersUsed = rows.reduce((sum, r) => sum + 1 + (r.user_counter_count ?? 0), 0);

    const blockingOffer = rows.find(r => ["pending", "approved", "countered"].includes(r.status));
    if (blockingOffer) {
      existingOfferStatus = blockingOffer.status;
    } else {
      const declinedOffer = rows.find(r => r.status === "declined");
      if (declinedOffer) {
        existingOfferStatus = "declined";
        existingDeclineReason = declinedOffer.decline_reason;
      }
    }
  }

  // Pull CGC fields from already-cached settings instead of a separate DB call
  const ebayConfig = (settings as any)?.ebay_config ?? {};
  const cgcCensusUrl      = ebayConfig.cgc_census_url       ?? null;
  const cgcButtonImageUrl = ebayConfig.cgc_button_image_url ?? null;
  const certNumber = ((product as any).certification_number as string | null)?.trim() || null;
  const hasCgcMark =
    product.name.toLowerCase().includes("cgc") ||
    ((product as any).professional_grader as string | null)?.toLowerCase().includes("cgc");
  const showCgcButton = cgcCensusUrl && hasCgcMark && certNumber != null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
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

  // Build the full category ancestor chain: grandparent → parent → category
  const categoryChain: { label: string; href: string }[] = [];
  if (product.categories) {
    const cat = product.categories;
    if (cat.parent?.parent) {
      categoryChain.push({ label: cat.parent.parent.name, href: `/category/${cat.parent.parent.slug}` });
    }
    if (cat.parent) {
      categoryChain.push({ label: cat.parent.name, href: `/category/${cat.parent.slug}` });
    }
    categoryChain.push({ label: cat.name, href: `/category/${cat.slug}` });
  }

  const breadcrumbCrumbs = [
    { label: "Home", href: "/" },
    ...categoryChain,
    { label: product.name },
  ];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbCrumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...("href" in c && c.href ? { item: (c.href as string).startsWith("http") ? c.href : `${appUrl}${c.href}` } : {}),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <div className="relative py-8">
        {/* Breadcrumbs — always padded */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs crumbs={breadcrumbCrumbs} />
        </div>

        <div className="mx-auto max-w-7xl lg:px-8">
          <div className="flex flex-col lg:gap-8 lg:flex-row">
            {/* Image — edge-to-edge on mobile */}
            <div className="lg:w-1/2">
              <ProductImages images={images} name={product.name} />
            </div>

            {/* Info — padded on mobile, no extra padding on desktop */}
            <div className="lg:w-1/2 space-y-5 px-4 sm:px-6 lg:px-0 mt-6 lg:mt-0">
            {product.categories && (
              <p className="text-xs uppercase tracking-widest" style={{ opacity: 0.5 }}>
                {product.categories.name}
              </p>
            )}
            <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
            <p className="text-2xl font-semibold">{formatPrice(Number(product.price) * 100)}</p>

            {product.description && (
              <p className="text-sm leading-relaxed" style={{ opacity: 0.7 }}>{renderWithEmojiColor(product.description)}</p>
            )}

            {showCgcButton && (
              <a
                href={`${cgcCensusUrl}${certNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block transition-opacity hover:opacity-80"
              >
                {cgcButtonImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cgcButtonImageUrl}
                    alt="CGC Census / Grader Notes"
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
                    style={{ borderColor: "currentColor", opacity: 0.85 }}>
                    CGC Census / Grader Notes
                  </span>
                )}
              </a>
            )}

            <AddToCartButton product={product} />
            <FavoriteButton
              productId={product.id}
              initialFavorited={isFavorited}
              isLoggedIn={!!user}
              variant="detail"
            />
            {product.inventory > 0 && user && (
              <MakeOfferForm
                productId={product.id}
                listPrice={Number(product.price)}
                maxQuantity={product.inventory}
                existingStatus={existingOfferStatus}
                existingDeclineReason={existingDeclineReason}
                offersUsed={offersUsed}
                maxOffers={MAX_OFFERS}
              />
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
