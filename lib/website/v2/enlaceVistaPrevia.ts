/**
 * Verificación del enlace privado de la vista previa del borrador V2.
 *
 * ORIGEN: copia de `verificarTokenVistaPrevia` en
 * go-admin-erp/src/lib/website/v2/enlaceVistaPrevia.ts. El ERP firma; aquí solo se verifica.
 * Si el formato cambia, se cambia en los dos.
 *
 * Formato: `<carga>.<firma>` en base64url.
 *   carga = JSON { v: 1, o: organización, s: site_state_id, e: caduca (epoch s), r: URL del editor }
 *   firma = HMAC-SHA256(WEBSITE_PREVIEW_SECRET, "vista-previa-sitio:v1." + carga)
 *
 * Secreto: `WEBSITE_PREVIEW_SECRET` (mismo valor que en el ERP, ≥ 32 caracteres). Sin él,
 * ningún token es válido: la ruta responde 404 (falla cerrado).
 *
 * Solo servidor.
 */
import { createHmac, timingSafeEqual } from 'crypto'

const PREFIJO_FIRMA = 'vista-previa-sitio:v1.'
const LONGITUD_MINIMA_SECRETO = 32
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface CargaVistaPrevia {
  v: 1
  o: number
  s: string
  e: number
  r: string
}

export function secretoVistaPrevia(): string | null {
  const s = process.env.WEBSITE_PREVIEW_SECRET?.trim()
  return s && s.length >= LONGITUD_MINIMA_SECRETO ? s : null
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function desdeBase64url(texto: string): Buffer {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64')
}

export type ResultadoVerificacion =
  | { ok: true; carga: CargaVistaPrevia }
  | { ok: false; motivo: 'sin_secreto' | 'formato' | 'firma' | 'caducado' }

export function verificarTokenVistaPrevia(token: string, ahoraSeg = Math.floor(Date.now() / 1000)): ResultadoVerificacion {
  const secreto = secretoVistaPrevia()
  if (!secreto) return { ok: false, motivo: 'sin_secreto' }
  if (typeof token !== 'string' || token.length > 2048) return { ok: false, motivo: 'formato' }
  const partes = token.split('.')
  if (partes.length !== 2 || !partes[0] || !partes[1]) return { ok: false, motivo: 'formato' }
  const [cuerpo, firma] = partes
  const esperada = Buffer.from(base64url(createHmac('sha256', secreto).update(PREFIJO_FIRMA + cuerpo).digest()))
  const recibida = Buffer.from(firma)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return { ok: false, motivo: 'firma' }
  let c: Partial<CargaVistaPrevia>
  try {
    c = JSON.parse(desdeBase64url(cuerpo).toString('utf8'))
  } catch {
    return { ok: false, motivo: 'formato' }
  }
  if (
    c?.v !== 1 ||
    typeof c.o !== 'number' || !Number.isInteger(c.o) || c.o <= 0 ||
    typeof c.s !== 'string' || !UUID.test(c.s) ||
    typeof c.e !== 'number' || !Number.isInteger(c.e) ||
    typeof c.r !== 'string' || c.r.length > 512
  ) {
    return { ok: false, motivo: 'formato' }
  }
  if (c.e <= ahoraSeg) return { ok: false, motivo: 'caducado' }
  return { ok: true, carga: c as CargaVistaPrevia }
}

/** URL del editor firmada: solo http(s). Si no, no se ofrecen «Volver al editor» ni «Publicar». */
export function urlEditorSegura(r: string): string | null {
  try {
    const url = new URL(r)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}
