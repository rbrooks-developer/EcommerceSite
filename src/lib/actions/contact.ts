"use server";

import { getResendClient, FROM_EMAIL } from "@/lib/resend/client";
import { getSettings } from "@/lib/data/settings";
import { createServiceClient } from "@/lib/supabase/server";
import type { FooterConfig } from "@/types";

function isLikelySpam(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 6) return false;
  const vowels = letters.replace(/[^aeiouAEIOU]/g, "");
  // Real words have >15% vowels — below 10% is almost certainly random chars
  if (vowels.length / letters.length < 0.1) return true;
  // Long unbroken string with no spaces is suspicious
  if (trimmed.length > 25 && !/\s/.test(trimmed)) return true;
  return false;
}

export async function submitContactForm({
  firstName,
  lastName,
  email,
  message,
  honeypot,
}: {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  honeypot?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  // Honeypot — bots fill hidden fields, humans don't; silent ok so bots don't adapt
  if (honeypot && honeypot.trim().length > 0) return { ok: true };

  if (!firstName.trim() || !email.trim() || !message.trim()) {
    return { error: "First name, email, and message are required." };
  }

  // Entropy check — random-character names/messages get silently dropped
  if (isLikelySpam(firstName) || isLikelySpam(lastName) || isLikelySpam(message)) {
    return { ok: true };
  }

  const settings = await getSettings();
  const contactEmail = (settings?.contact_info as any)?.email as string | null;
  if (!contactEmail) {
    return { error: "No contact email is configured for this store." };
  }

  const siteTitle = settings?.site_title ?? "My Store";
  const footer = settings?.footer_config as FooterConfig | null;
  const displayName = footer?.display_name || siteTitle;

  const resend = getResendClient();
  try {
    await resend.emails.send({
      from: `${displayName} <${FROM_EMAIL}>`,
      to: contactEmail,
      replyTo: email,
      subject: `New message from ${firstName} ${lastName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#111827;">New Contact Form Message</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-weight:600;color:#374151;">Name</td><td style="padding:8px 0;color:#374151;">${firstName} ${lastName}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#374151;">Email</td><td style="padding:8px 0;color:#374151;"><a href="mailto:${email}">${email}</a></td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
          <h3 style="color:#111827;">Message</h3>
          <p style="color:#374151;white-space:pre-wrap;">${message}</p>
        </div>
      `,
    });
    return { ok: true };
  } catch {
    return { error: "Failed to send your message. Please try again." };
  }
}

export async function subscribeToNewsletter(email: string): Promise<{ ok?: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: trimmed });

  if (error) {
    if (error.code === "23505") {
      return { error: "This email is already subscribed." };
    }
    return { error: "Failed to subscribe. Please try again." };
  }
  return { ok: true };
}
