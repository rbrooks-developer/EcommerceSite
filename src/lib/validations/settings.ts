import { z } from "zod";

const bannerSchema = z.object({
  text: z.string(),
  link: z.string().nullable().optional(),
  bg_color: z.string().default("#000000"),
});

const navItemSchema = z.object({
  label: z.string(),
  link: z.string(),
});

const footerLinkSchema = z.object({
  label: z.string(),
  link: z.string(),
});

const socialSchema = z.object({
  platform: z.string(),
  url: z.string().url(),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color");

const carouselImageSchema = z.object({
  url: z.string().url(),
  link: z.string().optional(),
});

const carouselConfigSchema = z.object({
  images: z.array(carouselImageSchema).max(25).default([]),
  speed: z.number().min(5).max(120).default(40),
  direction: z.enum(["left", "right"]).default("left"),
  height: z.number().min(100).max(600).default(280),
  gap: z.number().min(0).max(48).default(16),
  image_fit: z.enum(["contain", "cover"]).default("contain"),
  image_padding: z.number().min(0).max(32).default(0),
  border_radius: z.number().min(0).max(50).default(8),
  pause_on_hover: z.boolean().default(true),
  fade_edges: z.boolean().default(true),
});

const chatConfigSchema = z.object({
  enabled: z.boolean().default(false),
  property_id: z.string().default(""),
  widget_id: z.string().default("default"),
});

export const siteSettingsSchema = z.object({
  site_title: z.string().min(1, "Site title is required"),
  meta_title: z.string().max(60).nullable().optional(),
  meta_description: z.string().max(160).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  logo_spin_header: z.boolean().nullable().optional(),
  logo_spin_hero: z.boolean().nullable().optional(),
  logo_spin_footer: z.boolean().nullable().optional(),
  favicon_url: z.string().url().nullable().optional(),
  tax_mode: z.enum(["stripe", "flat_rate", "none"]),
  tax_flat_rate: z.number().min(0).max(1).nullable().optional(),
  homepage_config: z.object({
    hero_heading: z.string(),
    hero_subtext: z.string(),
    hero_image_url: z.string().url().nullable().optional(),
    hero_cta_text: z.string(),
    hero_cta_link: z.string(),
    featured_product_ids: z.array(z.string().uuid()),
    featured_category_ids: z.array(z.string().uuid()),
    banners: z.array(bannerSchema),
    bg_color: hexColor.default("#ffffff"),
    font_color: hexColor.default("#111827"),
    font_family: z.string().default("default"),
    hero_display_name: z.string().optional(),
    hero_tagline: z.string().optional(),
    hero_font: z.string().default("Playfair Display"),
    service_images: z.array(z.string().url()).default([]),
    font_gradient_enabled: z.boolean().default(false),
    og_image_url: z.string().url().nullable().optional(),
    checkout_section_color: hexColor.optional(),
    checkout_textbox_color: hexColor.optional(),
    striation_image_url: z.string().url().nullable().optional(),
    striation_opacity: z.number().min(0).max(100).default(30),
    striation_blend_mode: z.string().default("screen"),
    striation_position: z.string().default("full"),
    hero_template: z.enum(["founder-and-creator", "widescreen"]).default("founder-and-creator"),
    carousel: carouselConfigSchema.optional(),
  }),
  nav_config: z.object({
    items: z.array(navItemSchema),
  }),
  footer_config: z.object({
    links: z.array(footerLinkSchema),
    social: z.array(socialSchema),
    copyright_text: z.string(),
    display_name: z.string().optional(),
    tagline: z.string().optional(),
    social_handle: z.string().optional(),
  }),
  contact_info: z.object({
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  chat_config: chatConfigSchema,
  tracking_config: z.object({
    ga4_id: z.string().nullable().optional(),
    meta_pixel_id: z.string().nullable().optional(),
    clarity_id: z.string().nullable().optional(),
  }).optional(),
  site_password: z.string().nullable().optional().transform((v) => v || null),
  handling_fee: z.number().min(0, "Handling fee cannot be negative").nullable().optional(),
  insurance_min_subtotal: z.number().min(0, "Must be 0 or greater").nullable().optional(),
  signature_min_subtotal: z.number().min(0, "Must be 0 or greater").nullable().optional(),
  checkout_config: z.object({
    restocking_fee_active: z.boolean().default(false),
    restocking_fee_percent: z.number().min(0).max(100).default(0),
    restocking_fee_disclaimer: z.string().default(""),
    processing_fee_flat: z.number().min(0).default(0),
  }).optional(),
  surcharge_config: z.object({
    surcharge_active: z.boolean().default(false),
    surcharge_percent: z.number().min(0).max(10).default(0),
    surcharge_min_order: z.number().min(0).default(0),
    surcharge_message: z.string().default("A processing surcharge may apply to certain credit card payments. If applicable, it will be calculated and displayed in your order summary before you place your order."),
  }).optional(),
  about_config: z.object({
    heading1: z.string().default("About Us"),
    body1: z.string().default(""),
    image1_url: z.string().url().nullable().optional(),
    heading2: z.string().default("Our Mission"),
    body2: z.string().default(""),
    image2_url: z.string().url().nullable().optional(),
  }).optional(),
  contact_config: z.object({
    heading: z.string().default("Get in Touch"),
    subheading: z.string().default("I'd like to hear from you!"),
    body_text: z.string().default("If you have any inquiries or just want to say hi, please use the contact form!"),
  }).optional(),
  product_config: z.object({
    products_per_page: z.number().int().min(4).max(200).default(24),
    category_sidebar_style: z.enum(["standard", "glow-bar", "pill", "count-badges", "frosted-cards"]).optional(),
  }).optional(),
  max_image_size_mb: z.number().int().min(1).max(50).default(2).optional(),
  shipping_countries: z.array(z.string()).min(1, "Select at least one shipping country"),
  store_address: z.object({
    name: z.string().min(1, "Store name is required"),
    street1: z.string().min(1, "Street address is required"),
    street2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().length(2, "Use 2-letter state code"),
    zip: z.string().min(5, "ZIP code is required"),
    country: z.string().default("US"),
    phone: z.string().optional(),
  }),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
