"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Upload } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  bucket?: string;
  pathPrefix?: string;
  maxSizeMb?: number;
}

export function ImageUpload({ value, onChange, max = 10, bucket = "product-images", pathPrefix = "products", maxSizeMb = 2 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    if (value.length >= max) {
      setError(`Maximum ${max} images allowed`);
      return;
    }

    const allowed = Array.from(files).slice(0, max - value.length);
    setError(null);
    setUploading(true);

    const supabase = createClient();
    const uploaded: string[] = [];

    for (const file of allowed) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        continue;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`Each image must be under ${maxSizeMb}MB`);
        continue;
      }

      const ALLOWED_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
      const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
      const ext = ALLOWED_EXTS.includes(rawExt) ? rawExt : "bin";
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file);

      if (uploadError) {
        setError(uploadError.message);
        continue;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    setUploading(false);
    if (uploaded.length > 0) onChange([...value, ...uploaded]);
  };

  const remove = (url: string) => {
    onChange(value.filter((u) => u !== url));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div key={url} className="relative h-24 w-24 rounded-md overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Product image" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 shadow hover:bg-white dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <X className="h-3 w-3 text-gray-700 dark:text-gray-100" />
            </button>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span className="mt-1 text-xs">Add image</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <p className="text-xs text-gray-500">
        {value.length}/{max} images · Max {maxSizeMb}MB each · JPEG, PNG, WebP
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
