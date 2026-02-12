/**
 * Aplica un template preset a una organización.
 * 
 * Flujo:
 * 1. Actualiza website_settings (colores, fuentes, header/footer style)
 * 2. Elimina website_pages + website_page_sections existentes (cascade)
 * 3. Crea las páginas y secciones definidas en el preset
 */

import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getTemplatePreset } from './presets'
import type { WebsitePageInsert, WebsitePageSectionInsert } from '@/types/database'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

export interface ApplyTemplateResult {
  success: boolean
  error?: string
  pages_created?: number
  sections_created?: number
}

export async function applyTemplateToOrganization(
  organizationId: number,
  presetId: string
): Promise<ApplyTemplateResult> {
  const preset = getTemplatePreset(presetId)
  if (!preset) {
    return { success: false, error: `Template preset "${presetId}" no encontrado` }
  }

  const supabase = getSupabase()

  try {
    // 1. Actualizar website_settings
    const settingsUpdate = {
      template_id: preset.id,
      primary_color: preset.theme.primary_color,
      secondary_color: preset.theme.secondary_color,
      accent_color: preset.theme.accent_color || null,
      background_color: preset.theme.background_color || null,
      text_color: preset.theme.text_color || null,
      theme_mode: preset.theme.theme_mode as 'light' | 'dark' | 'auto',
      font_heading: preset.fonts.heading,
      font_body: preset.fonts.body,
      header_style: preset.header_style as 'default' | 'transparent' | 'minimal' | 'centered',
      footer_style: preset.footer_style as 'default' | 'minimal' | 'centered' | 'three_columns',
      header_cta_text: preset.header_cta_text || null,
      header_cta_url: preset.header_cta_url || null,
      show_topbar: preset.show_topbar || false,
      logo_position: (preset.logo_position || 'left') as 'left' | 'center',
      updated_at: new Date().toISOString(),
    }
    const { error: settingsError } = await (supabase as any)
      .from('website_settings')
      .update(settingsUpdate)
      .eq('organization_id', organizationId)

    if (settingsError) {
      return { success: false, error: `Error actualizando settings: ${settingsError.message}` }
    }

    // 2. Eliminar páginas existentes del builder (cascade elimina secciones)
    const { error: deleteError } = await (supabase as any)
      .from('website_pages')
      .delete()
      .eq('organization_id', organizationId)

    if (deleteError) {
      return { success: false, error: `Error eliminando páginas existentes: ${deleteError.message}` }
    }

    // 3. Crear páginas y secciones del preset
    let totalPages = 0
    let totalSections = 0

    for (const pagePreset of preset.pages) {
      // Crear página
      const pageInsert: WebsitePageInsert = {
        organization_id: organizationId,
        slug: pagePreset.slug,
        title: pagePreset.title,
        show_in_header: pagePreset.show_in_header,
        show_in_footer: pagePreset.show_in_footer,
        header_order: pagePreset.header_order,
        footer_order: pagePreset.footer_order,
        page_type: 'builtin',
        is_published: true,
      }
      const { data: page, error: pageError } = await (supabase as any)
        .from('website_pages')
        .insert(pageInsert)
        .select('id')
        .single()

      if (pageError || !page) {
        console.error(`Error creando página ${pagePreset.slug}:`, pageError)
        continue
      }

      totalPages++

      // Crear secciones de la página
      const pageId = (page as any).id
      if (pagePreset.sections.length > 0) {
        const sectionsToInsert: WebsitePageSectionInsert[] = pagePreset.sections.map((s, index) => ({
          page_id: pageId,
          organization_id: organizationId,
          section_type: s.section_type,
          section_variant: s.section_variant,
          content: s.content || {},
          settings: s.settings || {},
          sort_order: index,
          is_visible: true,
        }))

        const { error: sectionsError } = await (supabase as any)
          .from('website_page_sections')
          .insert(sectionsToInsert)

        if (sectionsError) {
          console.error(`Error creando secciones para ${pagePreset.slug}:`, sectionsError)
        } else {
          totalSections += sectionsToInsert.length
        }
      }
    }

    return {
      success: true,
      pages_created: totalPages,
      sections_created: totalSections,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error desconocido' }
  }
}
