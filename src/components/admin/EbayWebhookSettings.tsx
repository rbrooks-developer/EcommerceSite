"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, XCircle, Loader2, Webhook, FlaskConical, AlertTriangle,
} from "lucide-react";
import type { EbayConfig } from "@/types";

type EventRow = {
  key: string;
  label: string;
  system: "Platform Notifications" | "Commerce Notification API";
  description: string;
};

const EVENT_ROWS: EventRow[] = [
  {
    key:         "FixedPriceTransaction",
    label:       "FixedPriceTransaction",
    system:      "Platform Notifications",
    description: "Fires when an item sells. Decrements inventory in your store.",
  },
  {
    key:         "ItemRevised",
    label:       "ItemRevised",
    system:      "Platform Notifications",
    description: "Fires when a listing is edited on eBay (price, qty, etc.).",
  },
  {
    key:         "ItemClosed",
    label:       "ItemClosed",
    system:      "Platform Notifications",
    description: "Fires when a listing ends. Zeros inventory and unpublishes the product.",
  },
  {
    key:         "MARKETPLACE_ACCOUNT_DELETION",
    label:       "MARKETPLACE_ACCOUNT_DELETION",
    system:      "Commerce Notification API",
    description: "Required by eBay Developer Program. Fires when a buyer requests account deletion.",
  },
];

type TestResult = { success: boolean; error?: string | null };
type AllTestResults = Record<string, TestResult & { status?: number; returned?: string; expected?: string }>;

interface Props {
  config: EbayConfig | null;
  isConnected: boolean;
}

export function EbayWebhookSettings({ config, isConnected }: Props) {
  const [installing, setInstalling] = useState(false);
  const [installResults, setInstallResults] = useState<Record<string, string> | null>(null);
  const [installError, setInstallError]     = useState<string | null>(null);

  const [testingEvent, setTestingEvent]     = useState<string | null>(null);
  const [testResults, setTestResults]       = useState<AllTestResults>({});

  const platformInstalled = !!config?.platform_notifications_installed_at;
  const accountDeletionSubscribed = !!config?.commerce_notification_subscribed_at;
  const lastHits = config?.webhook_last_hits ?? {};

  async function handleInstall() {
    setInstalling(true);
    setInstallResults(null);
    setInstallError(null);
    try {
      const res  = await fetch("/api/ebay/webhook/install", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setInstallError(data.error);
      } else {
        setInstallResults(data.results ?? {});
      }
    } catch (err) {
      setInstallError((err as Error).message);
    } finally {
      setInstalling(false);
    }
  }

  async function handleTest(event: string) {
    setTestingEvent(event);
    setTestResults((prev) => ({ ...prev, [event]: { success: false } }));
    try {
      const res  = await fetch("/api/ebay/webhook/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ event }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [event]: data }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [event]: { success: false, error: (err as Error).message },
      }));
    } finally {
      setTestingEvent(null);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Webhook Notifications</h2>
          <p className="mt-1 text-sm text-gray-500">
            Receive real-time eBay events at{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">
              /api/ebay/notifications
            </code>
            . Two systems must be configured: <strong>Platform Notifications</strong> for sold/revised/closed
            events, and the <strong>Commerce Notification API</strong> for the mandatory account-deletion
            compliance requirement.
          </p>
        </div>
      </div>

      {/* Installation status badges */}
      <div className="flex flex-wrap gap-3">
        <StatusBadge
          label="Platform Notifications"
          active={platformInstalled}
          since={config?.platform_notifications_installed_at ?? null}
        />
        <StatusBadge
          label="Account Deletion (Commerce API)"
          active={accountDeletionSubscribed}
          since={config?.commerce_notification_subscribed_at ?? null}
        />
      </div>

      {/* Install button */}
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleInstall}
          disabled={!isConnected || installing}
          loading={installing}
          variant="default"
        >
          <Webhook className="h-4 w-4" />
          {platformInstalled && accountDeletionSubscribed ? "Reinstall Webhooks" : "Install Webhooks"}
        </Button>
        {!isConnected && (
          <p className="text-xs text-gray-400">Connect your eBay account above to install webhooks.</p>
        )}
      </div>

      {/* Install result banners */}
      {installError && (
        <Banner variant="error" message={installError} />
      )}
      {installResults && (
        <div className="space-y-2">
          {Object.entries(installResults).map(([k, v]) => (
            <Banner
              key={k}
              variant={v.startsWith("error:") ? "error" : "success"}
              message={`${k}: ${v}`}
            />
          ))}
          {!Object.values(installResults).some((v) => v.startsWith("error:")) && (
            <p className="text-xs text-gray-500">Reload this page to see updated timestamps.</p>
          )}
        </div>
      )}

      {/* Event table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="pb-2 pr-4">Event</th>
              <th className="pb-2 pr-4">System</th>
              <th className="pb-2 pr-4">Last received</th>
              <th className="pb-2">Test</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {EVENT_ROWS.map((row) => {
              const hit    = lastHits[row.key] ?? null;
              const result = testResults[row.key];
              const isTesting = testingEvent === row.key;

              return (
                <tr key={row.key}>
                  <td className="py-3 pr-4">
                    <div className="font-mono text-xs font-medium text-gray-900">{row.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{row.description}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 whitespace-nowrap">
                      {row.system}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {hit ? (
                      <span
                        className="text-xs text-gray-700 font-medium"
                        suppressHydrationWarning
                        title={new Date(hit).toISOString()}
                      >
                        {new Date(hit).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Never</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(row.key)}
                        disabled={isTesting || !isConnected}
                        className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isTesting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <FlaskConical className="h-3 w-3" />
                        )}
                        Test
                      </button>
                      {result && (
                        result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <span title={result.error ?? "Failed"}>
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          </span>
                        )
                      )}
                    </div>
                    {result && !result.success && result.error && (
                      <p className="text-xs text-red-600 mt-1 max-w-[200px]">{result.error}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Challenge verification test */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Challenge Verification</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Tests that the GET challenge-response endpoint (required by eBay before accepting the
              account-deletion subscription) returns the correct SHA-256 hash.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleTest("challenge")}
              disabled={testingEvent === "challenge" || !config?.webhook_verification_token}
              className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {testingEvent === "challenge" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FlaskConical className="h-3 w-3" />
              )}
              Test Challenge
            </button>
            {testResults.challenge && (
              testResults.challenge.success ? (
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )
            )}
          </div>
        </div>
        {testResults.challenge && !testResults.challenge.success && (
          <div className="mt-2 rounded bg-red-50 border border-red-200 p-3 text-xs text-red-700 space-y-1">
            <p className="font-medium">Challenge mismatch</p>
            {testResults.challenge.error && <p>{testResults.challenge.error}</p>}
            {testResults.challenge.returned && (
              <p>Returned: <code className="font-mono">{testResults.challenge.returned}</code></p>
            )}
            {testResults.challenge.expected && (
              <p>Expected: <code className="font-mono">{testResults.challenge.expected}</code></p>
            )}
          </div>
        )}
        {!config?.webhook_verification_token && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Install webhooks first to generate a verification token.
          </div>
        )}
      </div>

      {/* Verification token display */}
      {config?.webhook_verification_token && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-gray-700">Verification Token</p>
          <p className="font-mono text-xs text-gray-600 break-all">
            {config.webhook_verification_token}
          </p>
          <p className="text-xs text-gray-400">
            Stored in your site settings. Re-installing webhooks regenerates this token.
          </p>
        </div>
      )}

    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ label, active, since }: { label: string; active: boolean; since: string | null }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      {active ? (
        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-gray-400 shrink-0" />
      )}
      <div>
        <p className="text-xs font-medium text-gray-800">{label}</p>
        {active && since ? (
          <p className="text-xs text-gray-500" suppressHydrationWarning>
            Installed {new Date(since).toLocaleDateString()}
          </p>
        ) : (
          <p className="text-xs text-gray-400">Not installed</p>
        )}
      </div>
    </div>
  );
}

function Banner({ variant, message }: { variant: "success" | "error"; message: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        variant === "success"
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {variant === "success" ? (
        <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <span>{message}</span>
    </div>
  );
}
