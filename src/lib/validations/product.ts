import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  slug: z.string().min(1, "Slug is required").max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  price: z.number().positive("Price must be greater than 0"),
  cost: z.number().min(0, "Cost cannot be negative").nullable().optional(),
  inventory: z.number().int().min(0, "Inventory cannot be negative"),
  category_id: z.string().uuid().nullable().optional(),
  weight_oz: z.number().positive("Weight must be greater than 0"),
  length_in: z.number().positive("Length must be greater than 0").optional().default(1),
  width_in: z.number().positive("Width must be greater than 0").optional().default(1),
  height_in: z.number().positive("Height must be greater than 0").optional().default(1),
  is_published: z.boolean().default(false),
  seo_title: z.string().max(60).optional(),
  seo_description: z.string().max(160).optional(),
  images: z.array(z.string().url()).max(10, "Maximum 10 images allowed").default([]),
  hs_tariff_number: z.string().max(20).nullable().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
