/**
 * Mesa del QR — parte pura (sin React): formato guardado, saneo de la referencia y lectura.
 * La comparten el hook de la carta (`useMesaQR.ts`), el checkout y el servidor
 * (`/api/restaurant-tables/resolve`, `/api/orders`). Importarla desde el servidor no arrastra
 * hooks de React. Contrato completo en `useMesaQR.ts`.
 */

export interface MesaGuardada {
  /** Id de la mesa en `restaurant_tables` (uuid). Es lo que viaja al checkout como `tableRef`. */
  mesa: string
  /** `branch_id` de la mesa. */
  sede: number | null
  /** Epoch en ms a partir del cual la mesa ya no vale. */
  expira: number
  nombre?: string
  zona?: string | null
  nombreSede?: string | null
}

/** Cuánto vale un escaneo: una comida larga, no un día entero. */
export const DURACION_MESA_MS = 4 * 60 * 60 * 1000

export function claveMesa(subdomain: string): string {
  return `dine_in_table_${subdomain}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Códigos cortos de QR impresos antes (p. ej. «MESA-5»): alfanuméricos, guion, espacio, ≤ 20. */
const CODIGO_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,19}$/

/** Referencia de mesa saneada que viene de la URL, o `null` si no es plausible. */
export function refMesaDeUrl(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') return null
  const v = valor.trim()
  if (!v) return null
  if (UUID_RE.test(v)) return v.toLowerCase()
  return CODIGO_RE.test(v) ? v : null
}

function almacen(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

function borrarClaveAntigua(subdomain: string) {
  try {
    window.localStorage.removeItem(claveMesa(subdomain))
  } catch {
    /* almacenamiento bloqueado: nada que limpiar */
  }
}

export function guardarMesa(subdomain: string, mesa: MesaGuardada): void {
  try {
    almacen()?.setItem(claveMesa(subdomain), JSON.stringify(mesa))
  } catch {
    /* modo privado o cuota llena: la carta sigue funcionando sin mesa */
  }
}

/** Valida la forma de lo leído (lo escribió el navegador, puede venir alterado). */
export function parsearMesa(raw: string | null, ahora: number = Date.now()): MesaGuardada | null {
  if (!raw) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const mesa = typeof o.mesa === 'string' ? refMesaDeUrl(o.mesa) : null
  const expira = Number(o.expira)
  if (!mesa || !Number.isFinite(expira) || expira <= ahora) return null
  const sede = o.sede === null || o.sede === undefined ? null : Number(o.sede)
  return {
    mesa,
    sede: sede !== null && Number.isInteger(sede) && sede > 0 ? sede : null,
    expira,
    ...(typeof o.nombre === 'string' ? { nombre: o.nombre.slice(0, 80) } : {}),
    ...(typeof o.zona === 'string' ? { zona: o.zona.slice(0, 80) } : {}),
    ...(typeof o.nombreSede === 'string' ? { nombreSede: o.nombreSede.slice(0, 80) } : {}),
  }
}

/**
 * Mesa vigente del navegador para esa sede. `null` si no hay, si caducó o si es de otra sede
 * (`branchId` = sede del carrito; sin ella no se filtra por sede).
 */
export function leerMesaGuardada(subdomain: string, branchId?: number | null): MesaGuardada | null {
  if (typeof window === 'undefined') return null
  borrarClaveAntigua(subdomain)
  const s = almacen()
  let raw: string | null = null
  try {
    raw = s?.getItem(claveMesa(subdomain)) ?? null
  } catch {
    return null
  }
  const mesa = parsearMesa(raw)
  if (!mesa) {
    if (raw) limpiar(subdomain)
    return null
  }
  if (typeof branchId === 'number' && mesa.sede !== null && mesa.sede !== branchId) return null
  return mesa
}

/** Olvida la mesa (pedido confirmado, «No estoy en la mesa», QR inválido). */
export function limpiar(subdomain: string): void {
  try {
    almacen()?.removeItem(claveMesa(subdomain))
  } catch {
    /* nada */
  }
  if (typeof window !== 'undefined') {
    borrarClaveAntigua(subdomain)
    window.dispatchEvent(new CustomEvent('mesa-qr-updated'))
  }
}
export { limpiar as limpiarMesaGuardada }
