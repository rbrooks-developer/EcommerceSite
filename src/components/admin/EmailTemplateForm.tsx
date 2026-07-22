"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createEmailTemplate, updateEmailTemplate } from "@/lib/actions/email-templates";
import type { EmailTemplate } from "@/lib/actions/email-templates";

const SAMPLE_VARS: Record<string, string> = {
  "product.name": "Amazing Fantasy #15 CGC 9.8",
  "product.description": "Classic silver age key issue in stunning near-mint condition.",
  "product.price": "$1,200.00",
  "product.image_url": "",
  "promo.code": "FANS20",
  "promo.discount": "20% off",
  "promo.expiry": "August 31, 2026",
  "store.name": "My Store",
  "store.url": "#",
};

function substituteVars(text: string, vars: Record<string, string>) {
  const result = text.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) =>
    vars[key.trim()] ? content : ""
  );
  return result.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
}

const DEFAULT_BODY = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#111827;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">{{store.name}}</h1>
    </div>
    {{#if product.image_url}}
    <img src="{{product.image_url}}" alt="{{product.name}}" style="width:100%;max-height:300px;object-fit:contain;background:#f9fafb" />
    {{/if}}
    <div style="padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">You saved this. Now it's yours for less.</h2>
      <p style="color:#6b7280;margin:0 0 16px;font-size:14px">{{product.name}}</p>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px;line-height:1.6">{{product.description}}</p>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <span style="font-size:18px;font-weight:700;color:#111827">{{product.price}}</span>
      </div>
      <div style="background:#fefce8;border:1px dashed #fbbf24;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center">
        <p style="margin:0 0 4px;font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Your exclusive discount</p>
        <p style="margin:0 0 4px;font-size:28px;font-weight:800;color:#111827;letter-spacing:0.1em">{{promo.code}}</p>
        <p style="margin:0;font-size:13px;color:#92400e">{{promo.discount}} · Expires {{promo.expiry}}</p>
      </div>
      <a href="{{store.url}}" style="display:block;background:#111827;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:600;font-size:15px">
        Shop Now
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">© {{store.name}} · You're receiving this because you saved this item.</p>
    </div>
  </div>
</body>
</html>`;

const VARIABLES = [
  { key: "{{product.name}}", desc: "Product title" },
  { key: "{{product.description}}", desc: "Product description" },
  { key: "{{product.price}}", desc: "Formatted price" },
  { key: "{{product.image_url}}", desc: "Product image URL" },
  { key: "{{promo.code}}", desc: "Promo code" },
  { key: "{{promo.discount}}", desc: "e.g. '20% off' or '$10 off'" },
  { key: "{{promo.expiry}}", desc: "Expiration date" },
  { key: "{{store.name}}", desc: "Your store name" },
  { key: "{{store.url}}", desc: "Your store URL" },
];

export function EmailTemplateForm({ template }: { template?: EmailTemplate }) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "You saved {{product.name}} — here's a special offer");
  const [body, setBody] = useState(template?.body ?? DEFAULT_BODY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"editor" | "preview">("editor");

  const previewHtml = substituteVars(body, SAMPLE_VARS);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { setError("Template name is required."); return; }
    if (!subject.trim()) { setError("Subject is required."); return; }
    setSaving(true);
    setError("");
    const result = template
      ? await updateEmailTemplate(template.id, { name, subject, body })
      : await createEmailTemplate({ name, subject, body });
    setSaving(false);
    if ("error" in result && result.error) { setError(result.error); return; }
    router.push("/admin/email-templates");
  }, [name, subject, body, template, router]);

  const copyVar = (key: string) => {
    navigator.clipboard.writeText(key).catch(() => {});
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        {/* Left: form fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Favorites Promo"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="You saved {{product.name}} — here's a special offer"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">Variables like {"{{product.name}}"} are substituted at send time.</p>
          </div>

          {/* Editor / Preview tabs */}
          <div>
            <div className="flex gap-1 mb-2">
              <button
                type="button"
                onClick={() => setTab("editor")}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === "editor" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                HTML Editor
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === "preview" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Preview
              </button>
            </div>

            {tab === "editor" ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={24}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                spellCheck={false}
              />
            ) : (
              <div className="rounded-md border border-gray-200 overflow-hidden" style={{ height: "520px" }}>
                <iframe
                  srcDoc={previewHtml}
                  title="Email preview"
                  className="w-full h-full"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: variable reference */}
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Available Variables</p>
            <p className="text-xs text-gray-500 mb-3">Click to copy. Use in subject or body.</p>
            <div className="space-y-2">
              {VARIABLES.map(({ key, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => copyVar(key)}
                  title="Click to copy"
                  className="w-full text-left rounded-md border border-gray-200 bg-white px-3 py-2 hover:border-gray-400 transition-colors group"
                >
                  <code className="text-xs text-blue-600 font-mono group-hover:text-blue-800">{key}</code>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Preview uses sample data</p>
            <p className="text-xs text-amber-700">Real emails substitute the actual product, promo, and store details at send time.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : template ? "Save Changes" : "Create Template"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/email-templates")}
          className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
