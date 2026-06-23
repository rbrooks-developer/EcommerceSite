import { Resend } from "resend";

let _client: Resend | null = null;

export function getResendClient() {
  if (!_client) {
    _client = new Resend(process.env.RESEND_API_KEY!);
  }
  return _client;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@yourdomain.com";
