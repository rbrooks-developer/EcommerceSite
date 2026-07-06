export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus = "pending" | "paid" | "shipped" | "fulfilled" | "cancelled" | "refunded" | "partially_refunded";
export type UserRole = "customer" | "admin";
export type TaxMode = "stripe" | "flat_rate" | "none";
export type PromoDiscountType = "percentage" | "fixed" | "free_shipping";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          avatar_url: string | null;
          theme_preference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          avatar_url?: string | null;
          theme_preference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          role?: UserRole;
          avatar_url?: string | null;
          theme_preference?: string | null;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          price: number;
          cost: number | null;
          inventory: number;
          images: string[];
          category_id: string | null;
          weight_oz: number;
          length_in: number;
          width_in: number;
          height_in: number;
          is_published: boolean;
          seo_title: string | null;
          seo_description: string | null;
          ebay_listing_id: string | null;
          genre: string | null;
          grade: string | null;
          professional_grader: string | null;
          certification_number: string | null;
          signed: boolean | null;
          signed_by: string | null;
          hs_tariff_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          price: number;
          cost?: number | null;
          inventory?: number;
          images?: string[];
          category_id?: string | null;
          weight_oz: number;
          length_in: number;
          width_in: number;
          height_in: number;
          is_published?: boolean;
          seo_title?: string | null;
          seo_description?: string | null;
          ebay_listing_id?: string | null;
          genre?: string | null;
          grade?: string | null;
          professional_grader?: string | null;
          certification_number?: string | null;
          signed?: boolean | null;
          signed_by?: string | null;
          hs_tariff_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          price?: number;
          cost?: number | null;
          inventory?: number;
          images?: string[];
          category_id?: string | null;
          weight_oz?: number;
          length_in?: number;
          width_in?: number;
          height_in?: number;
          is_published?: boolean;
          seo_title?: string | null;
          seo_description?: string | null;
          ebay_listing_id?: string | null;
          genre?: string | null;
          grade?: string | null;
          professional_grader?: string | null;
          certification_number?: string | null;
          signed?: boolean | null;
          signed_by?: string | null;
          hs_tariff_number?: string | null;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          parent_id: string | null;
          ebay_category_id: string | null;
          ebay_category_name: string | null;
          hs_tariff_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          parent_id?: string | null;
          ebay_category_id?: string | null;
          ebay_category_name?: string | null;
          hs_tariff_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          parent_id?: string | null;
          ebay_category_id?: string | null;
          ebay_category_name?: string | null;
          hs_tariff_number?: string | null;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          status: OrderStatus;
          subtotal: number;
          shipping_cost: number;
          tax_amount: number;
          total_price: number;
          stripe_session_id: string | null;
          stripe_payment_intent_id: string | null;
          selected_shipping_rate: Json | null;
          insurance_required: boolean;
          signature_required: boolean;
          tracking_number: string | null;
          shipping_label_url: string | null;
          customs_form_url: string | null;
          easypost_shipment_id: string | null;
          shipping_name: string;
          shipping_address_line1: string;
          shipping_address_line2: string | null;
          shipping_city: string;
          shipping_state: string;
          shipping_zip: string;
          shipping_country: string;
          refunded_amount: number;
          promo_code: string | null;
          promo_id: string | null;
          discount_amount: number;
          shipping_discount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: OrderStatus;
          subtotal: number;
          shipping_cost: number;
          tax_amount: number;
          total_price: number;
          refunded_amount?: number;
          promo_code?: string | null;
          promo_id?: string | null;
          discount_amount?: number;
          shipping_discount?: number;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          selected_shipping_rate?: Json | null;
          insurance_required?: boolean;
          signature_required?: boolean;
          tracking_number?: string | null;
          shipping_label_url?: string | null;
          customs_form_url?: string | null;
          easypost_shipment_id?: string | null;
          shipping_name: string;
          shipping_address_line1: string;
          shipping_address_line2?: string | null;
          shipping_city: string;
          shipping_state: string;
          shipping_zip: string;
          shipping_country?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: OrderStatus;
          tracking_number?: string | null;
          shipping_label_url?: string | null;
          customs_form_url?: string | null;
          easypost_shipment_id?: string | null;
          refunded_amount?: number;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          price: number;
          created_at?: string;
        };
        Update: never;
      };
      site_settings: {
        Row: {
          id: number;
          site_title: string;
          meta_title: string | null;
          meta_description: string | null;
          logo_url: string | null;
          logo_spin_header: boolean | null;
          logo_spin_hero: boolean | null;
          logo_spin_footer: boolean | null;
          favicon_url: string | null;
          bg_color: string;
          font_color: string;
          font_family: string;
          homepage_config: Json;
          nav_config: Json;
          footer_config: Json;
          contact_info: Json;
          store_address: Json;
          tax_mode: TaxMode;
          tax_flat_rate: number | null;
          insurance_min_subtotal: number;
          signature_min_subtotal: number;
          tracking_config: Json | null;
          default_hs_tariff_number: string | null;
          promo_banner: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          site_title?: string;
          meta_title?: string | null;
          meta_description?: string | null;
          logo_url?: string | null;
          logo_spin_header?: boolean | null;
          logo_spin_hero?: boolean | null;
          logo_spin_footer?: boolean | null;
          favicon_url?: string | null;
          bg_color?: string;
          font_color?: string;
          font_family?: string;
          homepage_config?: Json;
          nav_config?: Json;
          footer_config?: Json;
          contact_info?: Json;
          store_address?: Json;
          tax_mode?: TaxMode;
          tax_flat_rate?: number | null;
          insurance_min_subtotal?: number;
          signature_min_subtotal?: number;
          tracking_config?: Json | null;
          default_hs_tariff_number?: string | null;
          promo_banner?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          site_title?: string;
          meta_title?: string | null;
          meta_description?: string | null;
          logo_url?: string | null;
          logo_spin_header?: boolean | null;
          logo_spin_hero?: boolean | null;
          logo_spin_footer?: boolean | null;
          favicon_url?: string | null;
          bg_color?: string;
          font_color?: string;
          font_family?: string;
          homepage_config?: Json;
          nav_config?: Json;
          footer_config?: Json;
          contact_info?: Json;
          store_address?: Json;
          tax_mode?: TaxMode;
          tax_flat_rate?: number | null;
          insurance_min_subtotal?: number;
          signature_min_subtotal?: number;
          tracking_config?: Json | null;
          default_hs_tariff_number?: string | null;
          promo_banner?: Json | null;
          updated_at?: string;
        };
      };
      tariff_codes: {
        Row: {
          id: string;
          hs_tariff_number: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          hs_tariff_number: string;
          description: string;
          created_at?: string;
        };
        Update: {
          hs_tariff_number?: string;
          description?: string;
        };
      };
      admin_notifications: {
        Row: {
          id: string;
          type: string;
          severity: "info" | "warning" | "error";
          title: string;
          body: string;
          metadata: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          severity?: "info" | "warning" | "error";
          title: string;
          body: string;
          metadata?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
      };
      promos: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          enabled: boolean;
          discount_type: PromoDiscountType;
          discount_value: number;
          max_shipping_discount: number | null;
          start_date: string | null;
          expiration_date: string | null;
          minimum_order: number | null;
          maximum_order: number | null;
          max_uses: number | null;
          current_uses: number;
          max_uses_per_customer: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          enabled?: boolean;
          discount_type: PromoDiscountType;
          discount_value: number;
          max_shipping_discount?: number | null;
          start_date?: string | null;
          expiration_date?: string | null;
          minimum_order?: number | null;
          maximum_order?: number | null;
          max_uses?: number | null;
          current_uses?: number;
          max_uses_per_customer?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          description?: string | null;
          enabled?: boolean;
          discount_type?: PromoDiscountType;
          discount_value?: number;
          max_shipping_discount?: number | null;
          start_date?: string | null;
          expiration_date?: string | null;
          minimum_order?: number | null;
          maximum_order?: number | null;
          max_uses?: number | null;
          current_uses?: number;
          max_uses_per_customer?: number | null;
          updated_at?: string;
        };
      };
      promo_redemptions: {
        Row: {
          id: string;
          promo_id: string;
          order_id: string;
          customer_id: string | null;
          customer_email: string | null;
          discount_amount: number;
          shipping_discount: number;
          redeemed_at: string;
        };
        Insert: {
          id?: string;
          promo_id: string;
          order_id: string;
          customer_id?: string | null;
          customer_email?: string | null;
          discount_amount?: number;
          shipping_discount?: number;
          redeemed_at?: string;
        };
        Update: never;
      };
      cart_promos: {
        Row: {
          user_id: string;
          promo_code: string;
          applied_at: string;
        };
        Insert: {
          user_id: string;
          promo_code: string;
          applied_at?: string;
        };
        Update: {
          promo_code?: string;
          applied_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
