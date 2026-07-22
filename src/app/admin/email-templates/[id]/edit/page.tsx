import { notFound } from "next/navigation";
import { getEmailTemplate } from "@/lib/actions/email-templates";
import { EmailTemplateForm } from "@/components/admin/EmailTemplateForm";

export default async function EditEmailTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getEmailTemplate(id);
  if (!template) notFound();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
        <p className="text-sm text-gray-500 mt-1">{template.name}</p>
      </div>
      <EmailTemplateForm template={template} />
    </div>
  );
}
