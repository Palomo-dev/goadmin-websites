import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { cargarAjustesResenas, MAX_BYTES_FOTO_RESENA } from '@/lib/resenas/ajustesResenas'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/fotos — sube UNA foto de una opinión (multipart, campo `foto`).
 *
 * Organización del host; bucket público `review-images`, ruta `<org>/<año-mes>/<uuid>.<ext>`.
 * JPG, PNG o WEBP de hasta 5 MB (se comprueba la firma del archivo, no solo el tipo que declara el
 * navegador). Si la tienda apagó «Permitir fotos», 403. Límite: 10 fotos por hora por IP.
 * Devuelve `{ url }`, que `POST /api/reviews` solo acepta si es de esta organización.
 */
const TIPOS: Record<string, { ext: string; firma: (b: Uint8Array) => boolean }> = {
  'image/jpeg': { ext: 'jpg', firma: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', firma: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/webp': { ext: 'webp', firma: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 },
}

export async function POST(request: NextRequest) {
  const sinCache = { 'Cache-Control': 'private, no-store' }
  const organizationId = await getOrgIdDelHost()
  if (!organizationId) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404, headers: sinCache })

  const r = checkRateLimit(`resena-foto:${getClientIP(request)}`, 10, 60 * 60 * 1000)
  if (!r.allowed) return NextResponse.json({ error: 'Subiste muchas fotos. Espera un momento.', codigo: 'limite' }, { status: 429, headers: sinCache })

  const sb = createAdminClient() as any
  if (!sb) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500, headers: sinCache })
  const ajustes = await cargarAjustesResenas(sb, organizationId)
  if (!ajustes) return NextResponse.json({ error: 'No pudimos subir la foto.' }, { status: 500, headers: sinCache })
  if (!ajustes.fotos) return NextResponse.json({ error: 'Esta tienda no recibe fotos en las opiniones.', codigo: 'sin_fotos' }, { status: 403, headers: sinCache })

  const form = await request.formData().catch(() => null)
  const archivo = form?.get('foto')
  if (!archivo || typeof archivo === 'string') return NextResponse.json({ error: 'Falta la foto.' }, { status: 400, headers: sinCache })
  if (archivo.size > MAX_BYTES_FOTO_RESENA) {
    const mb = (archivo.size / (1024 * 1024)).toFixed(0)
    return NextResponse.json({ error: `La foto pesa ${mb} MB; el máximo es 5 MB.`, codigo: 'muy_grande' }, { status: 413, headers: sinCache })
  }
  const tipo = TIPOS[archivo.type]
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  if (!tipo || bytes.length < 12 || !tipo.firma(bytes)) {
    return NextResponse.json({ error: 'Solo JPG, PNG o WEBP.', codigo: 'tipo' }, { status: 415, headers: sinCache })
  }

  const mes = new Date().toISOString().slice(0, 7)
  const ruta = `${organizationId}/${mes}/${randomUUID()}.${tipo.ext}`
  const { error } = await sb.storage.from('review-images').upload(ruta, bytes, { contentType: archivo.type, upsert: false, cacheControl: '31536000' })
  if (error) {
    console.error('[api/reviews/fotos] No se pudo subir', { organizationId, error: error.message })
    return NextResponse.json({ error: 'No pudimos subir la foto. Intenta de nuevo.' }, { status: 500, headers: sinCache })
  }
  const { data } = sb.storage.from('review-images').getPublicUrl(ruta)
  return NextResponse.json({ url: data.publicUrl }, { status: 201, headers: sinCache })
}
