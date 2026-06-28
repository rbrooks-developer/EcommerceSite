import type { Database } from "./database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type SiteSettings = Database["public"]["Tables"]["site_settings"]["Row"];

export type OrderWithItems = Order & {
  order_items: (OrderItem & { product: Pick<Product, "id" | "name" | "images"> })[];
  profile: Pick<Profile, "email">;
};

export type ProductWithCategory = Product & {
  category: Category | null;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  weight_oz: number;
  length_in: number;
  width_in: number;
  height_in: number;
  offerId?: string; // present = quantity locked, price = accepted offer price
};

export type ProductOffer = {
  counter_price?: number | null;
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  offer_price: number;
  status: "pending" | "approved" | "declined" | "purchased" | "expired" | "out_of_stock" | "countered";
  decline_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShippingAddress = {
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type EasyPostRate = {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  delivery_days: number | null;
  delivery_date: string | null;
};

export type HomepageConfig = {
  hero_heading: string;
  hero_subtext: string;
  hero_image_url: string | null;
  hero_cta_text: string;
  hero_cta_link: string;
  featured_product_ids: string[];
  featured_category_ids: string[];
  banners: { text: string; link: string | null; bg_color: string }[];
  bg_color?: string;
  font_color?: string;
  font_family?: string;
  hero_display_name?: string;
  hero_tagline?: string;
  hero_font?: string;
  service_images?: string[];
  font_gradient_enabled?: boolean;
  og_image_url?: string | null;
  checkout_section_color?: string;
  checkout_textbox_color?: string;
  striation_image_url?: string | null;
  striation_opacity?: number;
  striation_blend_mode?: string;
  striation_position?: string;
  carousel?: CarouselConfig;
};

export type CarouselImage = {
  url: string;
  link?: string;
};

export type CarouselConfig = {
  images: CarouselImage[];
  speed: number;
  direction: "left" | "right";
  height: number;
  gap: number;
  image_fit: "contain" | "cover";
  image_padding: number;
  border_radius: number;
  pause_on_hover: boolean;
  fade_edges: boolean;
};

export type NavConfig = {
  items: { label: string; link: string }[];
};

export type FooterConfig = {
  links: { label: string; link: string }[];
  social: { platform: string; url: string }[];
  copyright_text: string;
  display_name?: string;
  tagline?: string;
  social_handle?: string;
};

export type ContactInfo = {
  email: string | null;
  phone: string | null;
};

export type UserAddress = {
  id: string;
  user_id: string;
  label: string;
  first_name: string;
  last_name: string;
  company: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string | null;
  is_default_shipping: boolean;
  is_default_billing: boolean;
  created_at: string;
};

export type StoreAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
};
