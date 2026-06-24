import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Pick<Product, "id" | "slug" | "name" | "price" | "images"> }) {
  const image = (product.images as string[])[0];

  return (
    <Link href={`/products/${product.slug}`} className="group block" style={{ color: "inherit" }}>
      <div
        className="aspect-square overflow-hidden rounded-lg relative"
        style={{ backgroundColor: "rgba(128,128,128,0.12)" }}
      >
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.25 }}>
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium group-hover:underline underline-offset-2 line-clamp-2">{product.name}</h3>
        <p className="mt-1 text-sm font-semibold" style={{ opacity: 0.75 }}>{formatPrice(Number(product.price) * 100)}</p>
      </div>
    </Link>
  );
}
