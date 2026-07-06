import { PromoForm } from "../PromoForm";

export const metadata = { title: "New Promo" };

export default function NewPromoPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">New Promo Code</h1>
      <PromoForm />
    </div>
  );
}
