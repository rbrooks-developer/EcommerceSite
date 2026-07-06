"use client";

import { useState } from "react";
import type { PromoBanner } from "@/lib/actions/promos";
import { updatePromoBanner } from "@/lib/actions/promos";

export function BannerForm({ initial }: { initial: PromoBanner }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [html, setHtml] = useState(initial.html);
  const [bgColor, setBgColor] = useState(initial.bg_color);
  const [textColor, setTextColor] = useState(initial.text_color);
  const [fontSize, setFontSize] = useState(initial.font_size);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updatePromoBanner({ enabled, html, bg_color: bgColor, text_color: textColor, font_size: fontSize });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputClass = "rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Promo Banner</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show banner on site</span>
        </label>
      </div>

      {/* Style controls */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Background</label>
          <div className="flex items-center gap-2">
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border border-gray-300 dark:border-gray-600 p-0.5" />
            <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
              className={`w-24 ${inputClass}`} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Text Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border border-gray-300 dark:border-gray-600 p-0.5" />
            <input type="text" value={textColor} onChange={(e) => setTextColor(e.target.value)}
              className={`w-24 ${inputClass}`} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Font Size (px)</label>
          <input type="number" min="10" max="32" value={fontSize} onChange={(e) => setFontSize(e.target.value)}
            className={`w-20 ${inputClass}`} />
        </div>
      </div>

      {/* HTML content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Banner Message
          <span className="ml-2 text-xs font-normal text-gray-400">HTML supported — e.g. <code>&lt;strong&gt;Sale!&lt;/strong&gt; Use code SAVE10</code></span>
        </label>
        <textarea
          rows={3}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          placeholder="<strong>Free shipping</strong> on orders over $50! Use code <em>FREESHIP</em>"
        />
      </div>

      {/* Live preview */}
      {html && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Preview</p>
          <div
            className="w-full px-4 py-2.5 text-center"
            style={{ backgroundColor: bgColor, color: textColor, fontSize: `${fontSize}px` }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Banner"}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
      </div>
    </div>
  );
}
