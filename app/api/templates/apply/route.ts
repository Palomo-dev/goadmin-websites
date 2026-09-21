import { NextRequest, NextResponse } from 'next/server'
import { getPresetsForBusinessType } from '@/lib/templates/presets'

export const dynamic = 'force-dynamic'

/**
 * POST /api/templates/apply — DESACTIVADO (2026-09-21).
 *
 * Aceptaba `organization_id` en el body sin autenticación, usaba el cliente
 * con service role y borraba todas las páginas de esa organización antes de
 * recrearlas, sin transacción. No tenía ningún llamador en este repositorio
 * ni en el ERP. La aplicación de plantillas vuelve en el editor V2 como
 * importación a borrador con organización derivada de la sesión
 * (docs/website-builder-v2/ADR-002-DECISIONES-Y-SECUENCIA.md, D10).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Endpoint desactivado. La aplicación de plantillas se realiza desde el editor del ERP.',
    },
    { status: 410 }
  )
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
