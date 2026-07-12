"use client";

import { useState, useTransition } from "react";
import { Trash2, ChevronDown, ChevronUp, Phone, Mail, MessageSquare, ExternalLink } from "lucide-react";
import { markCollectionRead, deleteCollectionRequest } from "@/lib/actions/collection";

type CollectionRequest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  image_urls: string[];
  is_read: boolean;
  created_at: string;
};

export function CollectionRow({
  request,
  formattedDate,
}: {
  request: CollectionRequest;
  formattedDate: string;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [confirming, setConfirming]   = useState(false);
  const [deleted, setDeleted]         = useState(false);
  const [isPending, startTransition]  = useTransition();

  const handleExpand = () => {
    setExpanded((v) => !v);
    if (!request.is_read && !expanded) {
      startTransition(() => markCollectionRead(request.id));
    }
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteCollectionRequest(request.id, request.image_urls);
      setDeleted(true);
    });
  };

  if (deleted) return null;

  const isUnread = !request.is_read;

  return (
    <div className={`transition-colors ${isUnread ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}>

      {/* Main row */}
      <div
        className="grid grid-cols-[24px_1fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        onClick={handleExpand}
      >
        {/* Unread dot */}
        <div className="flex justify-center">
          {isUnread && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
        </div>

        {/* Name */}
        <span className={`text-sm truncate ${isUnread ? "font-semibold text-gray-900 dark:text-gray-50" : "text-gray-700 dark:text-gray-300"}`}>
          {request.first_name} {request.last_name}
          {request.image_urls.length > 0 && (
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {request.image_urls.length} photo{request.image_urls.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>

        {/* Email */}
        <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{request.email}</span>

        {/* Phone */}
        <span className="text-sm text-gray-400 dark:text-gray-500 hidden sm:block whitespace-nowrap">
          {request.phone ?? "—"}
        </span>

        {/* Date */}
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formattedDate}</span>

        {/* Chevron */}
        <span className="text-gray-400 dark:text-gray-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 space-y-5 bg-gray-50/50 dark:bg-gray-900/30">

          {/* Contact strip */}
          <div className="flex flex-wrap gap-4 pt-4">
            <a
              href={`mailto:${request.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              {request.email}
            </a>
            {request.phone && (
              <a
                href={`tel:${request.phone.replace(/\D/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {request.phone}
              </a>
            )}
          </div>

          {/* Message */}
          {request.message && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <MessageSquare className="h-3.5 w-3.5" />
                Message
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
                {request.message}
              </p>
            </div>
          )}

          {/* Images */}
          {request.image_urls.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Photos ({request.image_urls.length})
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {request.image_urls.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group hover:border-blue-400 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Collection photo ${i + 1}`} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Submitted {formattedDate}
            </div>

            {/* Delete */}
            {!confirming ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
                className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete request
              </button>
            ) : (
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Delete request{request.image_urls.length > 0 ? ` + ${request.image_urls.length} image${request.image_urls.length !== 1 ? "s" : ""}` : ""}?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleDelete}
                  className="text-xs px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold"
                >
                  {isPending ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
