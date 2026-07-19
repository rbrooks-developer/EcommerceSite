"use client";

import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";
import { saveAvatarUrl } from "@/lib/actions/profile";
import { Camera, X, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface AvatarUploadProps {
  currentUrl: string | null;
  maxSizeMb?: number;
}

async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = 400;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Circular clip
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    cropArea.x * scaleX,
    cropArea.y * scaleY,
    cropArea.width * scaleX,
    cropArea.height * scaleY,
    0,
    0,
    size,
    size,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas empty"))), "image/png")
  );
}

export function AvatarUpload({ currentUrl, maxSizeMb = 2 }: AvatarUploadProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(currentUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  function openPicker() {
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > maxSizeMb * 1024 * 1024) { setError(`Image must be under ${maxSizeMb}MB.`); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    // Reset crop state for new image
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    e.target.value = "";
  }

  async function handleSave() {
    if (!imageSrc || !croppedArea) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const supabase = createClient();
      const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/png" });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const result = await saveAvatarUrl(data.publicUrl);
      if (result.error) throw new Error(result.error);
      setAvatarUrl(data.publicUrl);
      setImageSrc(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    const result = await saveAvatarUrl(null);
    if (result.error) setError(result.error);
    else setAvatarUrl(null);
    setSaving(false);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Current avatar / trigger */}
      <div className="relative">
        <div
          className="h-24 w-24 rounded-full overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold select-none" style={{ color: "var(--site-bg)" }}>?</span>
          )}
        </div>
        <button
          type="button"
          onClick={openPicker}
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Camera className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      <div className="flex gap-2 text-sm">
        <button type="button" onClick={openPicker} className="underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity">
          {avatarUrl ? "Change photo" : "Upload photo"}
        </button>
        {avatarUrl && (
          <button type="button" onClick={handleRemove} disabled={saving} className="flex items-center gap-1 opacity-50 hover:opacity-80 transition-opacity">
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* Crop modal */}
      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-sm font-semibold text-gray-900">Adjust your photo</h3>
              <button type="button" onClick={() => setImageSrc(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Crop area */}
            <div className="relative bg-black" style={{ height: 320 }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-5 py-3 flex items-center gap-3 border-t border-gray-100">
              <span className="text-xs text-gray-400 shrink-0">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-gray-900"
              />
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t">
              <button
                type="button"
                onClick={() => setImageSrc(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
              >
                {saving && <Spinner className="h-3.5 w-3.5" />}
                {saving ? "Saving…" : "Save Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
