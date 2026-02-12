import { NextRequest, NextResponse } from 'next/server'
import { applyTemplateToOrganization } from '@/lib/templates/apply-template'
import { getTemplatePreset, getPresetsForBusinessType } from '@/lib/templates/presets'

export const dynamic = 'force-dynamic'

/**
 * POST /api/templates/apply
 * 
 * Aplica un template preset a una organización.
 * Body: { organization_id: number, preset_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organization_id, preset_id } = body

    if (!organization_id || !preset_id) {
      return NextResponse.json(
        { error: 'Se requiere organization_id y preset_id' },
        { status: 400 }
      )
    }

    const preset = getTemplatePreset(preset_id)
    if (!preset) {
      return NextResponse.json(
        { error: `Template "${preset_id}" no encontrado` },
        { status: 404 }
      )
    }

    const result = await applyTemplateToOrganization(organization_id, preset_id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      template: preset_id,
      pages_created: result.pages_created,
      sections_created: result.sections_created,
    })
  } catch (err: any) {
    console.error('[API Templates Apply]', err)
    return NextResponse.json(
      { error: err.message || 'Error interno' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/templates/apply?business_type=retail
 * 
 * Lista los presets disponibles para un tipo de negocio.
 */
export async function GET(request: NextRequest) {
  const businessType = request.nextUrl.searchParams.get('business_type')

  if (!businessType) {
    return NextResponse.json(
      { error: 'Se requiere el parámetro business_type' },
      { status: 400 }
    )
  }

  const presets = getPresetsForBusinessType(businessType)

  return NextResponse.json({
    business_type: businessType,
    presets: presets.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      is_default: p.is_default,
      theme: p.theme,
      fonts: p.fonts,
      header_style: p.header_style,
      footer_style: p.footer_style,
      pages_count: p.pages.length,
      total_sections: p.pages.reduce((sum, pg) => sum + pg.sections.length, 0),
    })),
  })
}
