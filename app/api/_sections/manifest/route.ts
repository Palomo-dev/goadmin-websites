import { NextResponse } from 'next/server'
import { buildSectionManifest } from '@/lib/sectionManifest'

/**
 * GET /api/_sections/manifest
 *
 * Devuelve el manifiesto de secciones del sitio, derivado del SECTION_MAP
 * (ver `lib/sectionManifest.ts`). El ERP lo usa para verificar el contrato
 * editor ↔ sitio (F0.6).
 *
 * Es estático en build-time: no depende de la organización ni de la BD.
 */
export async function GET() {
  const manifest = buildSectionManifest()
  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
