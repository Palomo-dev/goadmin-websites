/**
 * Favicon que ve la pestaña del sitio público.
 *
 * Diseño › Logo y favicon lo guarda en `identidad.faviconUrl` del documento V2.
 * `ajustesPublicosDesdeDocumento` ya lo copia a `favicon_url` para el HTML, pero
 * `/api/favicon` y el metadata raíz leían la fila legacy (vacía) y caían al logo.
 * Aquí se resuelve el valor publicado, con la misma herencia de sede que el logo.
 *
 * Código puro: sin React, Next ni Supabase.
 */
import { resolverCampo, type DocumentoSitio } from './contrato/documentoSitio'

/** https o ruta del propio sitio. `//host` es otro dominio y no se sirve. */
export function urlIdentidadPublica(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return /^(https:\/\/|\/(?!\/))/i.test(limpio) ? limpio : null
}

/** Documento publicado del principal, cuando el que se sirve es de una sede. */
export interface PrincipalFavicon {
  documento: DocumentoSitio | null
}

/**
 * URL efectiva del favicon en el documento. `null` si no hay, si la sede lo vació
 * o si el valor no es una URL que se pueda publicar.
 */
export function faviconPublicoDesdeDocumento(
  documento: DocumentoSitio,
  principal: PrincipalFavicon | null,
): string | null {
  const propio = documento.identidad.faviconUrl
  const valor = principal
    ? resolverCampo<string>(
        principal.documento?.identidad.faviconUrl?.mode === 'value'
          ? principal.documento.identidad.faviconUrl.value
          : null,
        propio,
      )
    : propio?.mode === 'value'
      ? propio.value
      : null
  return urlIdentidadPublica(valor)
}

/** La sede (o el principal) borró el favicon: no heredar el de otro sitio. */
export function faviconVaciado(documento: DocumentoSitio): boolean {
  return documento.identidad.faviconUrl?.mode === 'clear'
}

/**
 * Orden: favicon publicado del documento, si no el de la fila legacy, si no el logo.
 * Un favicon vaciado no revive el legacy (podría ser el del principal).
 */
export function urlFaviconEfectiva(opciones: {
  documento: DocumentoSitio | null
  principal: PrincipalFavicon | null
  faviconLegacy: string | null
  logoUrl: string | null
}): string | null {
  const { documento, principal, faviconLegacy, logoUrl } = opciones
  if (documento) {
    const publicado = faviconPublicoDesdeDocumento(documento, principal)
    if (publicado) return publicado
    if (faviconVaciado(documento)) return urlIdentidadPublica(logoUrl)
  }
  return urlIdentidadPublica(faviconLegacy) ?? urlIdentidadPublica(logoUrl)
}

/** Fila legacy: el embed de `organizations` llega como objeto o como lista por sede. */
export function faviconLegacyDe(settings: unknown): string | null {
  const filas = Array.isArray(settings) ? settings : settings ? [settings] : []
  const principal =
    filas.find((fila) => fila && typeof fila === 'object' && (fila as { branch_id?: unknown }).branch_id == null) ??
    filas[0]
  if (!principal || typeof principal !== 'object') return null
  const url = (principal as { favicon_url?: unknown }).favicon_url
  return typeof url === 'string' ? url : null
}

/**
 * Href del `<link rel="icon">`. Lleva un sello de la URL real para que el navegador
 * no reutilice una respuesta vieja de `/api/favicon` (antes se cacheaba un día y
 * podía ser el logo).
 */
export function hrefIconoFavicon(url: string | null): string | null {
  if (!url) return null
  let sello = 0
  for (let i = 0; i < url.length; i++) sello = (Math.imul(sello, 31) + url.charCodeAt(i)) | 0
  return `/api/favicon?v=${(sello >>> 0).toString(36)}`
}

/** Convierte una ruta propia (`/icono.png`) en URL absoluta del host de la petición. */
export function urlFaviconParaFetch(url: string, cabeceras: Headers): string | null {
  if (/^https:\/\//i.test(url)) return url
  if (!url.startsWith('/') || url.startsWith('//')) return null
  const host = cabeceras.get('x-forwarded-host') || cabeceras.get('host')
  if (!host) return null
  const proto = cabeceras.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}${url}`
}
