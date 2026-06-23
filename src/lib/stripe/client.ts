import Stripe from "stripe";

let _client: Stripe | null = null;

export function getStripeClient() {
  if (!_client) {
    _client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-05-27.dahlia",
    });
  }
  return _client;
}
