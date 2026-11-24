import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheStructural, SETTINGS_TTL } from '@/lib/supabase/cache'

/**
 * Datos de `/api/currency` guardados entre peticiones.
 *
 * El 2026-11-24 la ruta se llamaba una vez por página vista y hacía 5 consultas cada vez
 * (moneda base, país del visitante, tasas, moneda destino y países activos): ~72.000 consultas
 * al día, el 13 % de todo lo que la tienda le pedía a la base, por datos que cambian una vez al
 * día (las tasas) o casi nunca (países y monedas).
 *
 * Las consultas son LAS MISMAS de antes, una por una, con los mismos filtros: solo se guarda su
 * resultado. Así la respuesta de la ruta no cambia en nada.
 *
 * Un fallo de la base NO se guarda: la función lanza dentro de la caché (Next no guarda lo que
 * lanza) y `sinFallo` devuelve el mismo vacío que la ruta ya usaba (`null`), para que la
 * siguiente petición vuelva a intentarlo.
 */

/** Países, monedas: catálogos que casi nunca cambian. */
const CATALOGO_TTL = 3600
/** Tasas: llegan una vez al día; diez minutos de atraso no cambian ningún precio mostrado. */
const TASAS_TTL = 600

class ErrorConsultaMoneda extends Error {}

function cliente(): any {
  return createAdminClient() || createPublicClient()
}

async function sinFallo<T>(nombre: string, consulta: () => Promise<T>, vacio: T): Promise<T> {
  try {
    return await consulta()
  } catch (error) {
    console.error(`[moneda] ${nombre}:`, error instanceof Error ? error.message : error)
    return vacio
  }
}

/** Código ISO de tres letras: lo único que entra como clave de caché desde la URL. */
function esCodigo(valor: string): boolean {
  return /^[A-Z]{3}$/.test(valor)
}

export interface PaisMoneda {
  code: string
  name?: string
  default_currency_code: string | null
  locale: string | null
}
export interface TasaMoneda {
  code: string
  rate: number | string
  rate_date: string
}
export interface InfoMoneda {
  code: string
  symbol: string
  decimals: number
  name: string
}

const leerMonedaBase = async (organizationId: number): Promise<string | null> => {
  const { data, error } = await cliente()
    .from('organization_currencies')
    .select('currency_code')
    .eq('organization_id', organizationId)
    .eq('is_base', true)
    .maybeSingle()
  if (error) throw new ErrorConsultaMoneda(error.message)
  return data?.currency_code ?? null
}
const monedaBaseCacheada = cacheStructural('moneda:base', leerMonedaBase, SETTINGS_TTL)

const leerPaisDeMoneda = async (moneda: string): Promise<Pick<PaisMoneda, 'code' | 'locale'> | null> => {
  const { data, error } = await cliente()
    .from('countries')
    .select('code, locale')
    .eq('default_currency_code', moneda)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw new ErrorConsultaMoneda(error.message)
  return data ?? null
}
const paisDeMonedaCacheado = cacheStructural('moneda:paisDeMoneda', leerPaisDeMoneda, CATALOGO_TTL)

const leerPaisPorCodigo = async (iso3: string): Promise<Pick<PaisMoneda, 'code' | 'default_currency_code' | 'locale'> | null> => {
  const { data, error } = await cliente()
    .from('countries')
    .select('code, default_currency_code, locale')
    .eq('code', iso3)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new ErrorConsultaMoneda(error.message)
  return data ?? null
}
const paisPorCodigoCacheado = cacheStructural('moneda:paisPorCodigo', leerPaisPorCodigo, CATALOGO_TTL)

const leerTasas = async (a: string, b: string): Promise<TasaMoneda[]> => {
  const { data, error } = await cliente()
    .from('currency_rates')
    .select('code, rate, rate_date')
    .in('code', [a, b])
    .order('rate_date', { ascending: false })
    .limit(10)
  if (error) throw new ErrorConsultaMoneda(error.message)
  return data ?? []
}
const tasasCacheadas = cacheStructural('moneda:tasas', leerTasas, TASAS_TTL)

const leerInfoMoneda = async (moneda: string): Promise<InfoMoneda | null> => {
  const { data, error } = await cliente()
    .from('currencies')
    .select('code, symbol, decimals, name')
    .eq('code', moneda)
    .maybeSingle()
  if (error) throw new ErrorConsultaMoneda(error.message)
  return data ?? null
}
const infoMonedaCacheada = cacheStructural('moneda:info', leerInfoMoneda, CATALOGO_TTL)

const leerPaisesActivos = async (): Promise<PaisMoneda[]> => {
  const { data, error } = await cliente()
    .from('countries')
    .select('code, name, default_currency_code, locale')
    .eq('is_active', true)
  if (error) throw new ErrorConsultaMoneda(error.message)
  return data ?? []
}
const paisesActivosCacheados = cacheStructural('moneda:paisesActivos', leerPaisesActivos, CATALOGO_TTL)

/** `currency_code` de la moneda base de la organización, o `null` si no tiene (la ruta usa COP). */
export function getMonedaBase(organizationId: number): Promise<string | null> {
  return sinFallo('moneda base', () => monedaBaseCacheada(organizationId), null)
}

/** País activo cuya moneda por defecto es `moneda` (para el `locale` de una elección manual). */
export function getPaisDeMoneda(moneda: string): Promise<Pick<PaisMoneda, 'code' | 'locale'> | null> {
  // Un valor que no es un código no entra a la caché (la clave sale de la URL): se consulta
  // directo, como antes.
  return sinFallo('país de la moneda', () => (esCodigo(moneda) ? paisDeMonedaCacheado(moneda) : leerPaisDeMoneda(moneda)), null)
}

/** País activo por su código ISO-3 (el del visitante). */
export function getPaisPorCodigo(iso3: string): Promise<Pick<PaisMoneda, 'code' | 'default_currency_code' | 'locale'> | null> {
  return sinFallo('país del visitante', () => (esCodigo(iso3) ? paisPorCodigoCacheado(iso3) : leerPaisPorCodigo(iso3)), null)
}

/** Las 10 tasas más recientes de las dos monedas (base USD), como las pedía la ruta. */
export function getTasasRecientes(base: string, destino: string): Promise<TasaMoneda[] | null> {
  // Clave en orden fijo: (COP, USD) y (USD, COP) son la misma consulta.
  const [a, b] = [base, destino].sort()
  return sinFallo('tasas', () => (esCodigo(a) && esCodigo(b) ? tasasCacheadas(a, b) : leerTasas(a, b)), null)
}

/** Símbolo, decimales y nombre de la moneda destino. */
export function getInfoMoneda(moneda: string): Promise<InfoMoneda | null> {
  return sinFallo('moneda destino', () => (esCodigo(moneda) ? infoMonedaCacheada(moneda) : leerInfoMoneda(moneda)), null)
}

/** Países activos, para la lista de monedas del selector. */
export function getPaisesActivos(): Promise<PaisMoneda[] | null> {
  return sinFallo('países activos', () => paisesActivosCacheados(), null)
}
