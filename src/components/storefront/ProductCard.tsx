import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

// 1×1 gray GIF — blurred by next/image to fill the container while the real image loads
const BLUR_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

export function ProductCard({ product }: { product: Pick<Product, "id" | "slug" | "name" | "price" | "images" | "inventory"> }) {
  const image = (product.images as string[])[0];
  const outOfStock = product.inventory <= 0;

  return (
    <Link href={`/products/${product.slug}`} className="group flex flex-col" style={{ color: "inherit" }}>
      <div
        className="aspect-square overflow-hidden rounded-lg relative"
        style={{ backgroundColor: "var(--product-detail-bg, transparent)", zIndex: 46, isolation: "isolate" }}
      >
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-contain p-2"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            placeholder="blur"
            blurDataURL={BLUR_URL}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.25 }}>
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-end p-2 pointer-events-none">
            <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "#fff", WebkitTextFillColor: "#fff" }}>
              Out of Stock
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-col flex-1">
        <h3
          className="text-sm font-medium group-hover:underline underline-offset-2"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          }}
        >{product.name}</h3>
        <p className="mt-auto pt-1 text-sm font-semibold" style={{ opacity: 0.75 }}>{formatPrice(Number(product.price) * 100)}</p>
      </div>
    </Link>
  );
}
