import { getResendClient, FROM_EMAIL } from "@/lib/resend/client";

interface SendShippingUpdateOptions {
  to: string;
  orderNumber: string;
  trackingNumber: string;
  carrier: string;
  siteTitle: string;
  siteUrl: string;
}

export async function sendShippingUpdate(opts: SendShippingUpdateOptions) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#111827;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">${opts.siteTitle}</h1>
    </div>
    <div style="padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Your order has shipped!</h2>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px">Order #${opts.orderNumber}</p>

      <div style="background:#f9fafb;border-radius:6px;padding:16px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Tracking Number</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#111827;letter-spacing:0.05em">${opts.trackingNumber}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280">${opts.carrier}</p>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;line-height:1.6">
        Use your tracking number on the carrier's website to track your package.
      </p>

      <a href="${opts.siteUrl}/products"
         style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600">
        Continue Shopping
      </a>
    </div>
  </div>
</body>
</html>`;

  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `Your order has shipped – #${opts.orderNumber}`,
    html,
  });
}
