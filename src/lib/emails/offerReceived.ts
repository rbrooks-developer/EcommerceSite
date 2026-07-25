import { getResendClient, FROM_EMAIL } from "@/lib/resend/client";

interface Options {
  to: string;
  productName: string;
  quantity: number;
  offerPrice: number;
  displayName: string;
  customerEmail: string;
  appUrl: string;
}

export async function sendOfferReceived(opts: Options) {
  const fromField = `${opts.displayName} <${FROM_EMAIL}>`;
  const total = (opts.offerPrice * opts.quantity).toFixed(2);
  const offersUrl = `${opts.appUrl}/admin/offers`;

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#111827;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">${opts.displayName}</h1>
    </div>
    <div style="padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">New Offer Received</h2>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px">A customer has submitted an offer. Review it in your admin panel.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;background:#f9fafb;border-radius:6px;overflow:hidden">
        <tr><td style="padding:10px 14px;color:#6b7280">Customer</td><td style="padding:10px 14px;font-weight:500;color:#111827">${opts.customerEmail}</td></tr>
        <tr style="background:#fff"><td style="padding:10px 14px;color:#6b7280">Product</td><td style="padding:10px 14px;font-weight:500;color:#111827">${opts.productName}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280">Quantity</td><td style="padding:10px 14px;font-weight:500;color:#111827">${opts.quantity}</td></tr>
        <tr style="background:#fff"><td style="padding:10px 14px;color:#6b7280">Offer price</td><td style="padding:10px 14px;font-weight:500;color:#111827">$${opts.offerPrice.toFixed(2)} each</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280">Total offer</td><td style="padding:10px 14px;font-weight:600;color:#111827">$${total}</td></tr>
      </table>
      <div style="margin-top:24px;text-align:center">
        <a href="${offersUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">Review Offers</a>
      </div>
    </div>
  </div>
</body></html>`;

  return getResendClient().emails.send({ from: fromField, to: opts.to, subject: `New Offer – ${opts.productName}`, html });
}
