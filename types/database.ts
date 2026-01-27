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
          hero_title: string | null
          hero_subtitle: string | null
          hero_image_url: string | null
          hero_video_url: string | null
          hero_cta_text: string | null
          hero_cta_url: string | null
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
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: number
          template_id?: string
          theme_mode?: 'light' | 'dark' | 'auto'
        }
        Update: {
          template_id?: string
          theme_mode?: 'light' | 'dark' | 'auto'
          hero_title?: string | null
          hero_subtitle?: string | null
          is_published?: boolean
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
        Row: {
          id: number
          product_id: number
          price: number
          currency_code: string
          is_default: boolean
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

// Tipos de negocio
export type BusinessType = 'restaurant' | 'hotel' | 'retail' | 'saas' | 'gym' | 'transport' | 'parking'
