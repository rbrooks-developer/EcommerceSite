"use client";

import dynamic from "next/dynamic";

const AvatarUpload = dynamic(
  () => import("./AvatarUpload").then((m) => m.AvatarUpload),
  { ssr: false, loading: () => <div className="h-24 w-24 rounded-full bg-gray-200 animate-pulse" /> }
);

export function AvatarUploadWrapper({ currentUrl }: { currentUrl: string | null }) {
  return <AvatarUpload currentUrl={currentUrl} />;
}
