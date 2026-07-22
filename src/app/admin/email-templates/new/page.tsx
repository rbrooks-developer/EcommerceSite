import { EmailTemplateForm } from "@/components/admin/EmailTemplateForm";

export default function NewEmailTemplatePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Email Template</h1>
        <p className="text-sm text-gray-500 mt-1">Design your email using HTML. Use variables to personalize each send.</p>
      </div>
      <EmailTemplateForm />
    </div>
  );
}
