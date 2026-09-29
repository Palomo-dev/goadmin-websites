export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: number
          uuid: string | null
          name: string
          legal_name: string
          description: string | null
          logo_url: string | null
          website: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          country: string | null
          postal_code: string | null
          tax_id: string | null
          nit: string | null
          dv: number | null
          type_id: number | null
          status: string | null
          primary_color: string | null
          secondary_color: string | null
          subdomain: string | null
          custom_domain: string | null
          owner_user_id: string | null
          plan_id: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          name: string
          legal_name: string
          description?: string | null
          type_id?: number | null
          subdomain?: string | null
          custom_domain?: string | null
          primary_color?: string | null
          secondary_color?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          subdomain?: string | null
          custom_domain?: string | null
          primary_color?: string | null
          secondary_color?: string | null
        }
      }
      organization_types: {
        Row: {
          id: number
          name: string
          description: string | null
          created_at: string | null
        }
      }
      organization_domains: {
        Row: {
          id: string
          organization_id: number
          host: string
          domain_type: 'system_subdomain' | 'custom_domain'
          status: 'pending' | 'verified' | 'failed'
          is_primary: boolean
          is_active: boolean
          verified_at: string | null
          created_at: string
          updated_at: string
        }
      }
      website_settings: {
        Row: {
          id: string
          organization_id: number
          template_id: string
          theme_mode: 'light' | 'dark' | 'auto'
          primary_color: string | null
          secondary_color: string | null
          accent_color: string | null
          background_color: string | null
          text_color: string | null
          font_heading: string | null
          font_body: string | null
          show_products: boolean
          show_services: boolean
          show_gallery: boolean
          show_testimonials: boolean
          show_team: boolean
          show_blog: boolean
          show_faq: boolean
          show_contact: boolean
          show_map: boolean
          show_social_links: boolean
          enable_reservations: boolean
          enable_online_ordering: boolean
          enable_appointments: boolean
          enable_memberships: boolean
          enable_tickets: boolean
          enable_parking_booking: boolean
          meta_title: string | null
          meta_description: string | null
          meta_keywords: string[] | null
          og_image_url: string | null
          social_links: Json
          business_hours: Json
          custom_css: string | null
          custom_scripts: string | null
          analytics_id: string | null
          gallery_images: Json
          testimonials: Json
          faq_items: Json
          footer_text: string | null
          footer_links: Json
          is_published: boolean
          published_at: string | null
          header_style: 'default' | 'transparent' | 'minimal' | 'centered' | 'split' | 'mega'
          footer_style: 'default' | 'minimal' | 'centered' | 'three_columns' | 'split'
          header_cta_text: string | null
          header_cta_url: string | null
          show_header_cart: boolean
          show_header_auth: boolean
          show_topbar: boolean
          show_powered_by: boolean
          show_buy_now_button: boolean
          logo_position: 'left' | 'center' | 'right'
          // Header configurable + mega-menú (Fase 0 migración header_configurable_mega_menu)
          menu_position: string
          search_style: string
          show_categories_in_header: boolean
          categories_menu_style: string
          mega_menu_columns: number
          mobile_menu_style: string
          mobile_search_style: string
          mobile_show_topbar: boolean
          mobile_sticky_header: boolean
          mobile_breakpoint: number
          header_opacity: number | null
          header_bg_color: string | null
          topbar_bg_color: string | null
          nav_bg_color: string | null
          topbar_show_email: boolean
          topbar_show_phone: boolean
          topbar_announcement: string | null
          topbar_contact_position: string
          logo_height: number | null
          favicon_height: number | null
          favicon_url: string | null
          // Menús nombrados de header (Fase 0 footer configurable)
          header_menu_id: string | null
          header_mega_menu_id: string | null
          // Configuración de footer (Fase 0 footer configurable)
          mobile_footer_style: string
          mobile_footer_show_social: boolean
          mobile_footer_show_hours: boolean
          footer_show_categories: boolean
          footer_columns: number
          footer_background: string
          footer_custom_bg_color: string | null
          footer_show_contact: boolean
          footer_show_hours: boolean
          footer_show_social: boolean
          footer_show_newsletter: boolean
          footer_newsletter_title: string | null
          footer_newsletter_placeholder: string | null
          footer_newsletter_button_text: string | null
          // F10: moderación de reseñas (auto-aprobar)
          reviews_auto_approve: boolean | null
          // Fase 12: Header Minimal drawer + iconos + CTA personalizable
          minimal_menu_style: string
          cart_icon: string | null
          search_icon: string | null
          auth_icon: string | null
          currency_icon: string | null
          actions_order: Json
          cta_padding_x: number
          cta_padding_y: number
          cta_border_radius: number
          cta_full_width: boolean
          cta_border_width: number
          cta_border_color: string | null
          cta_shadow: string
          cta_bg_color: string | null
          cta_text_color: string | null
          cta_margin_top: number
          cta_margin_bottom: number
          show_currency_code: boolean | null
          currency_position: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: number
          template_id?: string
          theme_mode?: 'light' | 'dark' | 'auto'
          header_style?: 'default' | 'transparent' | 'minimal' | 'centered' | 'split' | 'mega'
          footer_style?: 'default' | 'minimal' | 'centered' | 'three_columns' | 'split'
          header_bg_color?: string | null
          topbar_bg_color?: string | null
          nav_bg_color?: string | null
          header_opacity?: number | null
          reviews_auto_approve?: boolean | null
        }
        Update: {
          template_id?: string
          theme_mode?: 'light' | 'dark' | 'auto'
          primary_color?: string | null
          secondary_color?: string | null
          accent_color?: string | null
          background_color?: string | null
          text_color?: string | null
          font_heading?: string | null
          font_body?: string | null
          is_published?: boolean
          header_style?: 'default' | 'transparent' | 'minimal' | 'centered' | 'split' | 'mega'
          footer_style?: 'default' | 'minimal' | 'centered' | 'three_columns' | 'split'
          header_cta_text?: string | null
          header_cta_url?: string | null
          show_header_cart?: boolean
          show_header_auth?: boolean
          show_topbar?: boolean
          logo_position?: 'left' | 'center' | 'right'
          header_bg_color?: string | null
          topbar_bg_color?: string | null
          nav_bg_color?: string | null
          header_opacity?: number | null
          reviews_auto_approve?: boolean | null
          updated_at?: string
        }
      }
      website_visits: {
        Row: {
          id: string
          organization_id: number
          session_id: string
          page_path: string
          referrer: string | null
          user_agent: string | null
          country: string | null
          ip_hash: string | null
          device_type: string
          is_new_visitor: boolean
          created_at: string
        }
        Insert: {
          organization_id: number
          session_id: string
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          country?: string | null
          ip_hash?: string | null
          device_type?: string
          is_new_visitor?: boolean
        }
        Update: {
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          country?: string | null
          ip_hash?: string | null
          device_type?: string
          is_new_visitor?: boolean
        }
      }
      website_pages: {
        Row: {
          id: string
          organization_id: number
          slug: string
          title: string
          description: string | null
          page_type: 'builtin' | 'custom' | 'product_detail' | 'category_detail' | 'cart' | 'checkout' | 'order_confirmation' | 'space_detail' | 'account'
          show_in_header: boolean
          show_in_footer: boolean
          header_order: number
          footer_order: number
          is_published: boolean
          meta_title: string | null
          meta_description: string | null
          og_image_url: string | null
          // Jerarquía y mega-menú (Fase 0 migración header_configurable_mega_menu)
          parent_page_id: string | null
          linked_category_id: number | null
          menu_icon: string | null
          menu_badge: string | null
          // F9.3 — Ajustes de layout a nivel de página (columns, gallery_width, sticky_column)
          page_settings: Record<string, any> | null
          created_at: string
          updated_at: string
          // FASE 12 — borradores y versionado
          draft_content?: { sections: any[] } | null
          has_unpublished_changes?: boolean
          published_at?: string | null
        }
        Insert: {
          organization_id: number
          slug: string
          title: string
          description?: string | null
          page_type?: 'builtin' | 'custom' | 'product_detail' | 'category_detail' | 'cart' | 'checkout' | 'order_confirmation' | 'space_detail' | 'account'
          show_in_header?: boolean
          show_in_footer?: boolean
          header_order?: number
          footer_order?: number
          is_published?: boolean
          meta_title?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          parent_page_id?: string | null
          linked_category_id?: number | null
          menu_icon?: string | null
          menu_badge?: string | null
          page_settings?: Record<string, any> | null
          draft_content?: { sections: any[] } | null
          has_unpublished_changes?: boolean
          published_at?: string | null
        }
        Update: {
          slug?: string
          title?: string
          description?: string | null
          show_in_header?: boolean
          show_in_footer?: boolean
          header_order?: number
          footer_order?: number
          is_published?: boolean
          meta_title?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          parent_page_id?: string | null
          linked_category_id?: number | null
          menu_icon?: string | null
          menu_badge?: string | null
          draft_content?: { sections: any[] } | null
          has_unpublished_changes?: boolean
          published_at?: string | null
        }
      }
      website_page_versions: {
        Row: {
          id: string
          page_id: string
          organization_id: number
          content_snapshot: any
          created_by: string | null
          created_at: string
          note: string | null
        }
        Insert: {
          page_id: string
          organization_id: number
          content_snapshot: any
          created_by?: string | null
          note?: string | null
        }
        Update: {
          note?: string | null
        }
      }
      website_section_presets: {
        Row: {
          id: string
          organization_id: number
          name: string
          section_type: string
          section_variant: string
          content: any
          created_by: string | null
          created_at: string
        }
        Insert: {
          organization_id: number
          name: string
          section_type: string
          section_variant: string
          content?: any
          created_by?: string | null
        }
        Update: {
          name?: string
          content?: any
        }
      }
      website_page_sections: {
        Row: {
          id: string
          page_id: string
          organization_id: number
          section_type: string
          section_variant: string
          content: Json
          settings: Json
          sort_order: number
          is_visible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          page_id: string
          organization_id: number
          section_type: string
          section_variant?: string
          content?: Json
          settings?: Json
          sort_order?: number
          is_visible?: boolean
        }
        Update: {
          section_type?: string
          section_variant?: string
          content?: Json
          settings?: Json
          sort_order?: number
          is_visible?: boolean
        }
      }
      products: {
        Row: {
          id: number
          uuid: string | null
          organization_id: number
          sku: string | null
          name: string
          description: string | null
          category_id: number | null
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
      }
      product_prices: {
        // Columnas reales (verificadas el 2026-09-29). Antes declaraba `currency_code` e
        // `is_default`, que no existen. El precio vigente es el de `effective_from` más
        // reciente ya iniciado y sin `effective_to` vencido.
        Row: {
          id: number
          product_id: number
          price: number
          compare_price: number | null
          effective_from: string
          effective_to: string | null
          created_at: string | null
        }
      }
      services: {
        Row: {
          id: string
          organization_id: number
          name: string
          description: string | null
          duration_minutes: number | null
          price: number | null
          currency_code: string | null
          status: string | null
          created_at: string | null
        }
      }
      spaces: {
        Row: {
          id: string
          branch_id: number
          space_type_id: string | null
          label: string
          floor_zone: string | null
          status: string
          created_at: string | null
        }
      }
      customers: {
        Row: {
          id: string
          organization_id: number
          first_name: string | null
          last_name: string | null
          email: string | null
          phone: string | null
          created_at: string | null
        }
      }
      website_menus: {
        Row: {
          id: string
          organization_id: number
          name: string
          slug: string
          location: string
          footer_column: number | null
          footer_order: number
          header_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: number
          name: string
          slug: string
          location?: string
          footer_column?: number | null
          footer_order?: number
          header_order?: number
          is_active?: boolean
        }
        Update: {
          name?: string
          slug?: string
          location?: string
          footer_column?: number | null
          footer_order?: number
          header_order?: number
          is_active?: boolean
        }
      }
      website_menu_items: {
        Row: {
          id: string
          menu_id: string
          organization_id: number
          item_type: string
          page_id: string | null
          category_id: number | null
          custom_label: string | null
          custom_url: string | null
          parent_item_id: string | null
          icon: string | null
          badge: string | null
          display_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          menu_id: string
          organization_id: number
          item_type?: string
          page_id?: string | null
          category_id?: number | null
          custom_label?: string | null
          custom_url?: string | null
          parent_item_id?: string | null
          icon?: string | null
          badge?: string | null
          display_order?: number
          is_active?: boolean
        }
        Update: {
          item_type?: string
          page_id?: string | null
          category_id?: number | null
          custom_label?: string | null
          custom_url?: string | null
          parent_item_id?: string | null
          icon?: string | null
          badge?: string | null
          display_order?: number
          is_active?: boolean
        }
      }
      // F10.4 — Reseñas reales de productos
      product_reviews: {
        Row: {
          id: string
          organization_id: number
          product_id: number
          customer_id: string | null
          order_id: string | null
          author_name: string
          author_city: string | null
          rating: number
          title: string | null
          content: string | null
          images: string[] | null
          is_verified_purchase: boolean
          status: string
          rejection_reason: string | null
          reply_text: string | null
          reply_at: string | null
          reply_by: string | null
          helpful_count: number
          reported_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: number
          product_id: number
          customer_id?: string | null
          order_id?: string | null
          author_name: string
          author_city?: string | null
          rating: number
          title?: string | null
          content?: string | null
          images?: string[] | null
          is_verified_purchase?: boolean
          status?: string
          rejection_reason?: string | null
          reply_text?: string | null
          reply_at?: string | null
          reply_by?: string | null
          helpful_count?: number
          reported_count?: number
        }
        Update: {
          id?: string
          organization_id?: number
          product_id?: number
          customer_id?: string | null
          order_id?: string | null
          author_name?: string
          author_city?: string | null
          rating?: number
          title?: string | null
          content?: string | null
          images?: string[] | null
          is_verified_purchase?: boolean
          status?: string
          rejection_reason?: string | null
          reply_text?: string | null
          reply_at?: string | null
          reply_by?: string | null
          helpful_count?: number
          reported_count?: number
        }
      }
      // ── Transporte (GO-1). Columnas verificadas contra el esquema real el 2026-09-15.
      // El sitio sólo LEE estas tablas (server-side, service role): Insert/Update cerrados.
      //
      // AVISO: hoy este Database NO resuelve para supabase-js 2.107 — está declarado como
      // `interface` (sin firma de índice) y ninguna tabla lleva `Relationships`, así que
      // Schema cae a `never` y ningún select se comprueba. Al corregirlo aparecen ~200
      // errores de tipo en el repo (evidencia en el issue de tipado del sitio). Estas cinco
      // tablas ya vienen en la forma correcta para ese momento. Mientras tanto, la compuerta
      // real de /tracking es scripts/verify-tracking.mjs.
      shipments: {
        Row: {
          id: string
          organization_id: number
          branch_id: number | null
          source_type: string
          source_id: string | null
          shipment_number: string
          customer_id: string | null
          address_id: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_department: string | null
          delivery_postal_code: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_contact_name: string | null
          delivery_contact_phone: string | null
          delivery_instructions: string | null
          carrier_id: string | null
          service_level: string | null
          tracking_number: string | null
          external_tracking_url: string | null
          package_count: number | null
          weight_kg: number | null
          volume_m3: number | null
          declared_value: number | null
          length_cm: number | null
          width_cm: number | null
          height_cm: number | null
          shipping_fee: number | null
          insurance_fee: number | null
          cod_amount: number | null
          total_cost: number | null
          currency: string | null
          expected_pickup_date: string | null
          expected_delivery_date: string | null
          picked_at: string | null
          dispatched_at: string | null
          delivered_at: string | null
          status: string | null
          notes: string | null
          internal_notes: string | null
          created_by: string | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
          payment_status: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      transport_carriers: {
        Row: {
          id: string
          organization_id: number
          name: string
          code: string
          carrier_type: string
          service_type: string
          api_provider: string | null
          api_credentials_ref: string | null
          tracking_url_template: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_email: string | null
          is_active: boolean | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      transport_events: {
        Row: {
          id: string
          reference_type: string
          reference_id: string
          event_type: string
          event_time: string
          stop_id: string | null
          latitude: number | null
          longitude: number | null
          location_text: string | null
          actor_type: string
          actor_id: string | null
          description: string | null
          payload: Json | null
          created_at: string | null
          sequence: number | null
          external_event_id: string | null
          source: string | null
          correlation_id: string | null
          organization_id: number | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      proof_of_delivery: {
        Row: {
          id: string
          shipment_id: string
          delivered_at: string
          recipient_name: string
          recipient_doc_type: string | null
          recipient_doc_number: string | null
          recipient_relationship: string | null
          signature_url: string | null
          photo_urls: string[] | null
          latitude: number | null
          longitude: number | null
          delivery_location_type: string | null
          driver_id: string | null
          device_info: Json | null
          notes: string | null
          customer_feedback: string | null
          customer_rating: number | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      delivery_attempts: {
        Row: {
          id: string
          shipment_id: string
          attempt_number: number
          attempted_at: string
          status: string
          failure_reason_code: string | null
          failure_reason_text: string | null
          latitude: number | null
          longitude: number | null
          driver_id: string | null
          driver_notes: string | null
          reschedule_date: string | null
          reschedule_notes: string | null
          photo_urls: string[] | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      // ── Membresías. Columnas verificadas contra el esquema real el 2026-09-29 (fases 1–2 del
      // ERP). El sitio sólo LEE estas tablas: las membresías las crea/activa la base al
      // confirmarse la venta (`fn_membresias_activar_venta`, desde el ERP). Insert/Update cerrados.
      membership_plans: {
        Row: {
          id: number
          organization_id: number
          name: string
          description: string | null
          duration_days: number
          /** OBSOLETO: el precio es el del producto (`product_prices`). Se retira en la fase 3. */
          price: number | null
          access_rules: Json | null
          is_active: boolean | null
          /** daily · weekly · monthly · quarterly · biannual · annual (CHECK) */
          frequency: string | null
          product_id: number | null
          /** day · week · month · year */
          duration_unit: string
          duration_value: number | null
          renewal_mode: string
          billing_mode: string
          grace_days: number
          requires_activation: boolean
          activation_window_days: number | null
          freeze_allowed: boolean
          freeze_max_times: number | null
          freeze_max_days: number | null
          allowed_branch_ids: number[] | null
          access_schedule: Json | null
          daily_checkin_limit: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      memberships: {
        Row: {
          id: number
          organization_id: number
          customer_id: string
          membership_plan_id: number
          start_date: string | null
          end_date: string
          /** pending · active · frozen · past_due · expired · cancelled (memberships_status_check) */
          status: string
          sale_id: string | null
          freeze_history: Json | null
          access_code: string | null
          notes: string | null
          product_id: number | null
          sale_item_id: string | null
          invoice_id: string | null
          branch_id: number | null
          plan_snapshot: Json | null
          activated_at: string | null
          grace_until: string | null
          cancelled_at: string | null
          cancel_reason: string | null
          /** pos · invoice · web · manual_legacy */
          source: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

// Tipos de ayuda
export type Organization = Database['public']['Tables']['organizations']['Row']
export type OrganizationType = Database['public']['Tables']['organization_types']['Row']
export type OrganizationDomain = Database['public']['Tables']['organization_domains']['Row']
export type WebsiteSettings = Database['public']['Tables']['website_settings']['Row']
export type WebsitePage = Database['public']['Tables']['website_pages']['Row']
export type WebsitePageInsert = Database['public']['Tables']['website_pages']['Insert']
export type WebsitePageSection = Database['public']['Tables']['website_page_sections']['Row']
export type ProductReview = Database['public']['Tables']['product_reviews']['Row']
export type ProductReviewInsert = Database['public']['Tables']['product_reviews']['Insert']

// Página con hijos anidados (árbol de menú header/footer)
export interface WebsitePageWithChildren extends WebsitePage {
  children: WebsitePageWithChildren[]
  level: number
}
export type WebsitePageSectionInsert = Database['public']['Tables']['website_page_sections']['Insert']
export type WebsiteMenu = Database['public']['Tables']['website_menus']['Row']
export type WebsiteMenuItem = Database['public']['Tables']['website_menu_items']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Space = Database['public']['Tables']['spaces']['Row']

// Tipo extendido de organización con relaciones
export interface OrganizationWithDetails extends Organization {
  organization_types: OrganizationType | null
  website_settings: WebsiteSettings | null
}

// Tipos de templates disponibles
export type TemplateId = 'modern' | 'classic' | 'minimal' | 'bold'

// Tipo de página con sus secciones
export interface WebsitePageWithSections extends WebsitePage {
  website_page_sections: WebsitePageSection[]
}

// Tipos de negocio
export type BusinessType = 'restaurant' | 'hotel' | 'retail' | 'saas' | 'gym' | 'transport' | 'parking'

// Item de menú con hijos (árbol jerárquico de website_menu_items)
export interface WebsiteMenuItemWithChildren extends WebsiteMenuItem {
  children: WebsiteMenuItemWithChildren[]
  // Datos relacionados (cargados vía join o query adicional)
  page?: { id: string; slug: string; title: string } | null
  category?: { id: number; name: string; slug: string } | null
}

// Menú con sus items en árbol jerárquico
export interface WebsiteMenuWithItems extends WebsiteMenu {
  items: WebsiteMenuItemWithChildren[]
}
