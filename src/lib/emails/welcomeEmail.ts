import { getResendClient, FROM_EMAIL } from "@/lib/resend/client";

export async function sendWelcomeEmail(to: string, siteTitle: string, siteUrl: string) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#111827;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">${siteTitle}</h1>
    </div>
    <div style="padding:32px 24px;text-align:center">
      <h2 style="margin:0 0 12px;font-size:18px;color:#111827">Welcome!</h2>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px;line-height:1.6">
        Your account has been created. You're all set to start shopping.
      </p>
      <a href="${siteUrl}/products"
         style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600">
        Browse Products
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
        If you didn't create this account, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;

  return getResendClient().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Welcome to ${siteTitle}`,
    html,
  });
}
