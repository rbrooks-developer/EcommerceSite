"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/lib/actions/favorites";

export function FavoriteButton({
  productId,
  initialFavorited,
  isLoggedIn,
  variant = "card",
}: {
  productId: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  variant?: "card" | "detail";
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    const prev = favorited;
    setFavorited(!prev);
    startTransition(async () => {
      try {
        const result = await toggleFavorite(productId);
        setFavorited(result.isFavorited);
      } catch {
        setFavorited(prev);
      }
    });
  }

  if (variant === "card") {
    return (
      <button
        onClick={handleClick}
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          zIndex: 10,
          borderRadius: "9999px",
          padding: "0.375rem",
          backgroundColor: "rgba(0,0,0,0.5)",
          border: "none",
          cursor: "pointer",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.15s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Heart
          style={{
            width: "1rem",
            height: "1rem",
            color: favorited ? "#ef4444" : "#ffffff",
            fill: favorited ? "#ef4444" : "none",
          }}
        />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        borderRadius: "0.75rem",
        padding: "0.75rem 1.25rem",
        fontSize: "0.875rem",
        fontWeight: 600,
        border: `1px solid ${favorited ? "#ef4444" : "rgba(0,0,0,0.2)"}`,
        color: favorited ? "#ef4444" : "var(--site-fg, #111827)",
        backgroundColor: "transparent",
        cursor: "pointer",
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      <Heart
        style={{
          width: "1rem",
          height: "1rem",
          color: favorited ? "#ef4444" : "currentColor",
          fill: favorited ? "#ef4444" : "none",
          flexShrink: 0,
        }}
      />
      {favorited ? "Saved" : "Save"}
    </button>
  );
}
