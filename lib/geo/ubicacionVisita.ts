/**
 * Ubicación APROXIMADA de una visita, desde las cabeceras que Vercel añade en
 * el borde (sin servicio externo):
 *
 *   x-vercel-ip-country         ISO 3166-1 alfa-2 ("CO")
 *   x-vercel-ip-country-region  ISO 3166-2 sin el país ("DC", "ANT")
 *   x-vercel-ip-city            ciudad, codificada como URI ("Bogot%C3%A1")
 *
 * Privacidad (decisión aprobada, Figma «03 › Analítica web»): solo país,
 * región y ciudad. NUNCA la IP en claro ni coordenadas: las cabeceras
 * `x-vercel-ip-latitude` / `-longitude` se ignoran a propósito. Un valor que no
 * tiene la forma esperada se descarta (null): mejor sin ubicación que con
 * basura en la analítica de otro.
 *
 * Columnas `website_visits.country`, `.region`, `.city` (migración del ERP
 * 20260930180010, aplicada antes de desplegar esto).
 */

export interface UbicacionVisita {
  country: string | null
  region: string | null
  city: string | null
}

type LectorCabeceras = { get(nombre: string): string | null }

const MAX_CIUDAD = 80

function pais(valor: string | null): string | null {
  const v = valor?.trim().toUpperCase() ?? ''
  // "XX" es el código de Vercel para «desconocido».
  return /^[A-Z]{2}$/.test(v) && v !== 'XX' ? v : null
}

function region(valor: string | null): string | null {
  const v = valor?.trim().toUpperCase() ?? ''
  return /^[A-Z0-9]{1,3}$/.test(v) ? v : null
}

function ciudad(valor: string | null): string | null {
  if (!valor) return null
  let v: string
  try {
    v = decodeURIComponent(valor)
  } catch {
    return null
  }
  // Sin caracteres de control; espacios normalizados; longitud acotada.
  // eslint-disable-next-line no-control-regex
  v = v.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim()
  if (!v || v.length > MAX_CIUDAD) return null
  // Una ciudad no lleva dígitos solos ni símbolos de URL/HTML.
  if (/[<>"{}\\/@]/.test(v) || /^\d+$/.test(v)) return null
  return v
}

export function ubicacionDesdeCabeceras(h: LectorCabeceras): UbicacionVisita {
  const country = pais(h.get('x-vercel-ip-country'))
  // Sin país, región y ciudad no significan nada: se descartan juntas.
  if (!country) return { country: null, region: null, city: null }
  return {
    country,
    region: region(h.get('x-vercel-ip-country-region')),
    city: ciudad(h.get('x-vercel-ip-city')),
  }
}
