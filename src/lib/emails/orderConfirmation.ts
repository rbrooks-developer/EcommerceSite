import { getResendClient, FROM_EMAIL } from "@/lib/resend/client";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface SendOrderConfirmationOptions {
  to: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  totalPrice: number;
  shippingName: string;
  shippingAddress: string;
  siteTitle: string;
}

export async function sendOrderConfirmation(opts: SendOrderConfirmationOptions) {
  const itemRows = opts.items
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right">$${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#111827;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">${opts.siteTitle}</h1>
    </div>
    <div style="padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Order Confirmed!</h2>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px">Order #${opts.orderNumber}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb">
            <th style="text-align:left;padding-bottom:8px;color:#6b7280;font-weight:500">Item</th>
            <th style="text-align:center;padding-bottom:8px;color:#6b7280;font-weight:500">Qty</th>
            <th style="text-align:right;padding-bottom:8px;color:#6b7280;font-weight:500">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:14px;space-y:4px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:#6b7280">Subtotal</span>
          <span>$${opts.subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:#6b7280">Shipping</span>
          <span>$${opts.shippingCost.toFixed(2)}</span>
        </div>
        ${opts.taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280">Tax</span><span>$${opts.taxAmount.toFixed(2)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;font-weight:600;font-size:15px;margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb">
          <span>Total</span>
          <span>$${opts.totalPrice.toFixed(2)}</span>
        </div>
      </div>

      <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:6px;font-size:13px;color:#374151">
        <p style="margin:0 0 4px;font-weight:500">Shipping to:</p>
        <p style="margin:0;color:#6b7280">${opts.shippingName}<br>${opts.shippingAddress}</p>
      </div>

      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center">
        You'll receive a shipping notification with a tracking number once your order ships.
      </p>
    </div>
  </div>
</body>
</html>`;

  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `Order Confirmed – #${opts.orderNumber}`,
    html,
  });
}
