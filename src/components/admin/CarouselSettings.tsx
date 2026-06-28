"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { X, Upload, GripVertical } from "lucide-react";
import type { CarouselConfig, CarouselImage } from "@/types";

const MAX_IMAGES = 25;

const DEFAULTS: CarouselConfig = {
  images: [],
  speed: 40,
  direction: "left",
  height: 280,
  gap: 16,
  image_fit: "contain",
  image_padding: 0,
  border_radius: 8,
  pause_on_hover: true,
  fade_edges: true,
};

const SPEED_PRESETS = [
  { label: "Fast", value: 15 },
  { label: "Medium", value: 40 },
  { label: "Slow", value: 80 },
] as const;

function Toggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${checked ? "bg-gray-900" : "bg-gray-200"}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

export function CarouselSettings({
  value,
  onChange,
}: {
  value: CarouselConfig | undefined;
  onChange: (v: CarouselConfig) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const dragIndex = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const config: CarouselConfig = { ...DEFAULTS, ...value };
  const update = (patch: Partial<CarouselConfig>) => onChange({ ...config, ...patch });

  // ── Upload ──────────────────────────────────────────────────────────────
  const handleFiles = async (files: FileList) => {
    const remaining = MAX_IMAGES - config.images.length;
    if (remaining <= 0) return;
    const allowed = Array.from(files).slice(0, remaining);
    setUploadError(null);
    setUploading(true);

    const supabase = createClient();
    const newImages: CarouselImage[] = [];
    const ALLOWED_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];

    for (const file of allowed) {
      if (!file.type.startsWith("image/")) { setUploadError("Only image files are allowed"); continue; }
      if (file.size > 12 * 1024 * 1024) { setUploadError("Each image must be under 12MB"); continue; }
      const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
      const ext = ALLOWED_EXTS.includes(rawExt) ? rawExt : "bin";
      const path = `carousel/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file);
      if (error) { setUploadError(error.message); continue; }
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      newImages.push({ url: data.publicUrl });
    }

    setUploading(false);
    if (newImages.length > 0) update({ images: [...config.images, ...newImages] });
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeImage = (i: number) => update({ images: config.images.filter((_, idx) => idx !== i) });

  const updateLink = (i: number, link: string) =>
    update({
      images: config.images.map((img, idx) =>
        idx === i ? { ...img, link: link || undefined } : img
      ),
    });

  // ── Drag and drop ────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, i: number) => {
    dragIndex.current = i;
    setDraggingIndex(i);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== i) setDragOverIndex(i);
  };

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from !== null && from !== i) {
      const newImages = [...config.images];
      const [moved] = newImages.splice(from, 1);
      newImages.splice(i, 0, moved);
      update({ images: newImages });
    }
    setDragOverIndex(null);
    setDraggingIndex(null);
    dragIndex.current = null;
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    setDraggingIndex(null);
    dragIndex.current = null;
  };

  return (
    <div className="space-y-6">
      {/* ── Images ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>
            Images{" "}
            <span className="text-gray-400 font-normal">
              ({config.images.length}/{MAX_IMAGES})
            </span>
          </Label>
          {config.images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading…" : "Add Images"}
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {uploadError && <p className="text-xs text-red-500 mb-2">{uploadError}</p>}

        {config.images.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-gray-400 transition-colors"
          >
            <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Click to upload carousel images</p>
            <p className="text-xs text-gray-400 mt-1">
              Up to {MAX_IMAGES} images · JPG, PNG, WEBP, GIF · Max 12 MB each
            </p>
          </button>
        ) : (
          <div className="space-y-2">
            {config.images.map((img, i) => (
              <div
                key={i}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 rounded-lg border p-2 transition-colors select-none ${
                  draggingIndex === i
                    ? "opacity-40 border-gray-300 bg-gray-50"
                    : dragOverIndex === i
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                {/* Drag handle */}
                <div
                  className="shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-5 w-5" />
                </div>

                {/* Thumbnail */}
                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" draggable={false} />
                </div>

                {/* Link input — stopPropagation so text-selection drag doesn't fight with row drag */}
                <div
                  className="flex-1 min-w-0"
                  onDragStart={(e) => e.stopPropagation()}
                >
                  <Input
                    value={img.link ?? ""}
                    onChange={(e) => updateLink(i, e.target.value)}
                    placeholder="Link URL (optional, e.g. /products)"
                    className="text-sm"
                  />
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="shrink-0 rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            {config.images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline disabled:opacity-50 mt-1"
              >
                {uploading && <Spinner className="h-3.5 w-3.5" />}
                {uploading
                  ? "Uploading…"
                  : `+ Add more (${MAX_IMAGES - config.images.length} remaining)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Speed ── */}
      <div>
        <Label>Scroll Speed</Label>
        <div className="flex gap-2 mt-1">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => update({ speed: preset.value })}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                config.speed === preset.value
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={config.speed}
            onChange={(e) => update({ speed: Number(e.target.value) })}
            className="w-full accent-gray-900"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>Fastest (5s)</span>
            <span className="font-medium text-gray-600">{config.speed}s per loop</span>
            <span>Slowest (120s)</span>
          </div>
        </div>
      </div>

      {/* ── Direction ── */}
      <div>
        <Label>Scroll Direction</Label>
        <div className="flex gap-2 mt-1">
          {(["left", "right"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => update({ direction: dir })}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                config.direction === dir
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {dir === "left" ? "← Scroll Left" : "Scroll Right →"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Height ── */}
      <div>
        <Label>Image Height: {config.height}px</Label>
        <input
          type="range"
          min="100"
          max="600"
          step="10"
          value={config.height}
          onChange={(e) => update({ height: Number(e.target.value) })}
          className="mt-1 w-full accent-gray-900"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>100px (compact)</span>
          <span>600px (tall)</span>
        </div>
      </div>

      {/* ── Gap ── */}
      <div>
        <Label>Gap Between Images: {config.gap}px</Label>
        <input
          type="range"
          min="0"
          max="48"
          step="4"
          value={config.gap}
          onChange={(e) => update({ gap: Number(e.target.value) })}
          className="mt-1 w-full accent-gray-900"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0px (edge to edge)</span>
          <span>48px (spaced)</span>
        </div>
      </div>

      {/* ── Image Fit ── */}
      <div>
        <Label>Image Fit</Label>
        <div className="flex gap-2 mt-1">
          {([
            { value: "contain", label: "Contain", desc: "Show full image" },
            { value: "cover",   label: "Cover",   desc: "Fill frame, may crop" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ image_fit: opt.value })}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                config.image_fit === opt.value
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {opt.label}
              <span className={`block text-xs font-normal mt-0.5 ${config.image_fit === opt.value ? "text-gray-300" : "text-gray-400"}`}>
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Image Padding ── */}
      <div>
        <Label>Image Padding: {config.image_padding}px</Label>
        <input
          type="range"
          min="0"
          max="32"
          step="4"
          value={config.image_padding}
          onChange={(e) => update({ image_padding: Number(e.target.value) })}
          className="mt-1 w-full accent-gray-900"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0px (edge to edge)</span>
          <span>32px (padded)</span>
        </div>
      </div>

      {/* ── Border Radius ── */}
      <div>
        <Label>Corner Roundness: {config.border_radius}px</Label>
        <input
          type="range"
          min="0"
          max="50"
          step="2"
          value={config.border_radius}
          onChange={(e) => update({ border_radius: Number(e.target.value) })}
          className="mt-1 w-full accent-gray-900"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0px (sharp)</span>
          <span>50px (pill)</span>
        </div>
      </div>

      {/* ── Toggles ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Toggle
            id="carousel_pause_hover"
            checked={config.pause_on_hover}
            onChange={(v) => update({ pause_on_hover: v })}
          />
          <div>
            <label htmlFor="carousel_pause_hover" className="text-sm font-medium text-gray-900 cursor-pointer">
              Pause on hover
            </label>
            <p className="text-xs text-gray-500">Stop scrolling when a visitor hovers over the carousel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            id="carousel_fade_edges"
            checked={config.fade_edges}
            onChange={(v) => update({ fade_edges: v })}
          />
          <div>
            <label htmlFor="carousel_fade_edges" className="text-sm font-medium text-gray-900 cursor-pointer">
              Fade edges
            </label>
            <p className="text-xs text-gray-500">
              Blend left and right edges into the site background color for a seamless look
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
