"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitCollectionRequest } from "@/lib/actions/collection";
import type { CollectionFormErrors } from "@/lib/actions/collection";
import { Upload, X, CheckCircle, ImageIcon, Loader2 } from "lucide-react";

const MAX_IMAGES = 10;
const MAX_FILE_MB = 12;
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];

interface FilePreview {
  file: File;
  objectUrl: string;
  uploading: boolean;
  uploadedUrl?: string;
  error?: string;
}

interface Props {
  asModal?: boolean;
  onClose?: () => void;
}

export function CollectionRequestForm({ asModal, onClose }: Props) {
  const [previews, setPreviews]       = useState<FilePreview[]>([]);
  const [dragging, setDragging]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState(false);
  const [errors, setErrors]           = useState<CollectionFormErrors>({});
  const [submitterName, setSubmitterName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── field refs ─────────────────────────────────────────
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef  = useRef<HTMLInputElement>(null);
  const emailRef     = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (fp: FilePreview): Promise<string | null> => {
    const supabase = createClient();
    const rawExt = fp.file.name.split(".").pop()?.toLowerCase() ?? "";
    const ext    = ALLOWED_EXTS.includes(rawExt) ? rawExt : "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("collection-images")
      .upload(filename, fp.file, { contentType: fp.file.type });

    if (error) return null;
    const { data } = supabase.storage.from("collection-images").getPublicUrl(filename);
    return data.publicUrl;
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    setPreviews((prev) => {
      const remaining = MAX_IMAGES - prev.length;
      if (remaining <= 0) return prev;
      const toAdd: FilePreview[] = arr.slice(0, remaining)
        .filter((f) => {
          if (!f.type.startsWith("image/")) return false;
          if (f.size > MAX_FILE_MB * 1024 * 1024) return false;
          return true;
        })
        .map((f) => ({ file: f, objectUrl: URL.createObjectURL(f), uploading: true }));
      return [...prev, ...toAdd];
    });

    // Upload each new file
    const toUpload = arr.slice(0, Math.max(0, MAX_IMAGES - previews.length))
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_FILE_MB * 1024 * 1024);

    for (const file of toUpload) {
      const objectUrl = URL.createObjectURL(file);
      const fp: FilePreview = { file, objectUrl, uploading: true };
      const uploadedUrl = await uploadFile(fp);
      setPreviews((prev) =>
        prev.map((p) =>
          p.file === file
            ? { ...p, uploading: false, uploadedUrl: uploadedUrl ?? undefined, error: uploadedUrl ? undefined : "Upload failed" }
            : p
        )
      );
    }
  }, [previews.length, uploadFile]);

  const removePreview = (objectUrl: string) => {
    setPreviews((prev) => {
      const removed = prev.find((p) => p.objectUrl === objectUrl);
      if (removed) URL.revokeObjectURL(removed.objectUrl);
      return prev.filter((p) => p.objectUrl !== objectUrl);
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const form = e.currentTarget;
    const fd   = new FormData(form);

    // Append successfully uploaded image URLs
    const uploadedUrls = previews
      .filter((p) => !p.uploading && p.uploadedUrl)
      .map((p) => p.uploadedUrl!);
    uploadedUrls.forEach((url) => fd.append("image_url", url));

    const stillUploading = previews.some((p) => p.uploading);
    if (stillUploading) {
      setErrors({ _form: "Please wait for all images to finish uploading." });
      return;
    }

    const firstName = (fd.get("first_name") as string ?? "").trim();
    const lastName  = (fd.get("last_name")  as string ?? "").trim();
    setSubmitterName(`${firstName} ${lastName}`);

    setSubmitting(true);
    const result = await submitCollectionRequest(fd);
    setSubmitting(false);

    if (result.errors) {
      setErrors(result.errors);
    } else if (result.ok) {
      setSuccess(true);
      previews.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    }
  };

  // ── Success state ──────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl" />
          <CheckCircle className="relative h-16 w-16 text-green-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--site-fg)" }}>
            Request Received!
          </h2>
          <p className="text-base opacity-70 max-w-sm" style={{ color: "var(--site-fg)" }}>
            Thanks, <strong>{submitterName}</strong>. We&apos;ve received your collection details and will be in touch soon.
          </p>
        </div>
        {asModal && onClose && (
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
          >
            Close
          </button>
        )}
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

        {/* Left: contact + message */}
        <div className="lg:col-span-3 space-y-5">

          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" required error={errors.first_name}>
              <input
                ref={firstNameRef}
                name="first_name"
                type="text"
                autoComplete="given-name"
                placeholder="Jane"
                className={inputCls(!!errors.first_name)}
              />
            </Field>
            <Field label="Last Name" required error={errors.last_name}>
              <input
                ref={lastNameRef}
                name="last_name"
                type="text"
                autoComplete="family-name"
                placeholder="Smith"
                className={inputCls(!!errors.last_name)}
              />
            </Field>
          </div>

          {/* Email */}
          <Field label="Email Address" required error={errors.email}>
            <input
              ref={emailRef}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="jane@example.com"
              className={inputCls(!!errors.email)}
            />
          </Field>

          {/* Phone */}
          <Field label="Phone" hint="Optional">
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(555) 000-0000"
              className={inputCls(false)}
            />
          </Field>

          {/* Message */}
          <Field label="Tell Us About Your Collection">
            <textarea
              name="message"
              rows={5}
              placeholder="Describe your collection — titles, grades, estimated quantity, condition, etc."
              className={inputCls(false) + " resize-none leading-relaxed py-3"}
            />
          </Field>

          {/* Submit */}
          {errors._form && (
            <p className="text-sm text-red-400 font-medium">{errors._form}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold tracking-widest uppercase transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Collection Request"
            )}
          </button>
        </div>

        {/* Right: image upload */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold tracking-widest uppercase opacity-60" style={{ color: "var(--site-fg)" }}>
              Photos
            </label>
            <span className="text-xs opacity-40" style={{ color: "var(--site-fg)" }}>
              {previews.length}/{MAX_IMAGES}
            </span>
          </div>

          {/* Drop zone */}
          {previews.length < MAX_IMAGES && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
                cursor-pointer transition-all duration-200 py-10 px-6 text-center
                ${dragging
                  ? "border-current bg-white/10 scale-[1.01]"
                  : "border-white/20 hover:border-white/40 hover:bg-white/5"}
              `}
            >
              <div className="rounded-full p-3" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 12%, transparent)" }}>
                <Upload className="h-6 w-6" style={{ color: "var(--site-fg)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--site-fg)" }}>
                  {dragging ? "Drop to add" : "Drag photos here"}
                </p>
                <p className="text-xs mt-1 opacity-50" style={{ color: "var(--site-fg)" }}>
                  or click to browse · up to {MAX_IMAGES} images · {MAX_FILE_MB}MB each
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>
          )}

          {/* Thumbnail grid */}
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {previews.map((p) => (
                <div
                  key={p.objectUrl}
                  className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.objectUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />

                  {/* Upload overlay */}
                  {p.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  )}

                  {/* Error overlay */}
                  {p.error && !p.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-900/70">
                      <ImageIcon className="h-5 w-5 text-red-300" />
                    </div>
                  )}

                  {/* Remove button */}
                  {!p.uploading && (
                    <button
                      type="button"
                      onClick={() => removePreview(p.objectUrl)}
                      className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {errors.images && (
            <p className="text-sm text-red-400">{errors.images}</p>
          )}

          <p className="text-xs opacity-40 leading-relaxed" style={{ color: "var(--site-fg)" }}>
            Clear, well-lit photos help us assess your collection and make you the best offer.
          </p>
        </div>

      </div>
    </form>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return [
    "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-150",
    "bg-white/5 border placeholder:opacity-30",
    "focus:bg-white/10 focus:ring-2 focus:ring-current",
    hasError ? "border-red-500/60 ring-1 ring-red-500/40" : "border-white/10 hover:border-white/25",
  ].join(" ");
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold tracking-widest uppercase opacity-60" style={{ color: "var(--site-fg)" }}>
          {label}
        </label>
        {required && <span className="text-red-400 text-xs">*</span>}
        {hint && <span className="text-xs opacity-30 ml-auto" style={{ color: "var(--site-fg)" }}>{hint}</span>}
      </div>
      <div style={{ color: "var(--site-fg)" }}>
        {children}
      </div>
      {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
}
