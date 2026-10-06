/**
 * Mesa del QR («Comer aquí») — contrato único entre la carta y el checkout.
 *
 * El QR de la mesa abre la carta con `?mesa=<ref>` (o el antiguo `?table=<ref>`). La referencia
 * se valida en el servidor (`GET /api/restaurant-tables/resolve`) contra `restaurant_tables` de la
 * organización del host: si no existe, no hay banner ni se guarda nada.
 *
 * Qué se guarda y dónde:
 * - `sessionStorage`, clave `dine_in_table_<subdominio>`: muere al cerrar la pestaña. Antes iba en
 *   `localStorage` sin caducidad y los pedidos posteriores (incluso desde casa) salían como
 *   «comer aquí»; {@link leerMesaGuardada} borra esa clave antigua al pasar.
 * - Formato `{ mesa, sede, expira, nombre?, zona? }`: `mesa` es el id de la mesa (uuid) que
 *   resolvió el servidor, `sede` su `branch_id`, `expira` epoch en ms (4 h desde el escaneo).
 *
 * El checkout (paquete A) lee con `leerMesaGuardada(subdominio, branchId)` y, al confirmar el
 * pedido o con «No estoy en la mesa», llama a `limpiar(subdominio)`. El servidor vuelve a validar
 * la mesa: lo que se guarda aquí es solo lo que el cliente vio.
 */

import { useCallback, useEffect, useState } from 'react'

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

interface RespuestaResolver {
  ok: boolean
  mesa?: { id: string; nombre: string; zona: string | null; sede: number; nombreSede: string | null }
}

/**
 * Hook de la carta: lee `?mesa=` / `?table=`, lo valida en el servidor y guarda la mesa. Sin
 * parámetro, devuelve la mesa ya guardada para esta sede. Con un id inválido, limpia y no hay mesa.
 */
export function useMesaQR(subdomain: string, branchId?: number | null): {
  mesa: MesaGuardada | null
  limpiar: () => void
} {
  const [mesa, setMesa] = useState<MesaGuardada | null>(null)
  const sub = subdomain || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '')

  useEffect(() => {
    if (!sub) return
    let vivo = true
    const params = new URLSearchParams(window.location.search)
    const crudo = params.get('mesa') ?? params.get('table')
    if (crudo === null) {
      setMesa(leerMesaGuardada(sub, branchId))
      const alCambiar = () => setMesa(leerMesaGuardada(sub, branchId))
      window.addEventListener('mesa-qr-updated', alCambiar)
      return () => {
        vivo = false
        window.removeEventListener('mesa-qr-updated', alCambiar)
      }
    }
    const ref = refMesaDeUrl(crudo)
    if (!ref) {
      limpiar(sub)
      setMesa(null)
      return
    }
    const qs = new URLSearchParams({ ref })
    if (typeof branchId === 'number') qs.set('branchId', String(branchId))
    fetch(`/api/restaurant-tables/resolve?${qs.toString()}`, { cache: 'no-store' })
      .then((r): Promise<RespuestaResolver> | RespuestaResolver => (r.ok ? (r.json() as Promise<RespuestaResolver>) : { ok: false }))
      .catch((): RespuestaResolver => ({ ok: false }))
      .then((res) => {
        if (!vivo) return
        if (!res.ok || !res.mesa) {
          limpiar(sub)
          setMesa(null)
          return
        }
        const nueva: MesaGuardada = {
          mesa: res.mesa.id,
          sede: res.mesa.sede,
          expira: Date.now() + DURACION_MESA_MS,
          nombre: res.mesa.nombre,
          zona: res.mesa.zona,
          nombreSede: res.mesa.nombreSede,
        }
        guardarMesa(sub, nueva)
        setMesa(nueva)
      })
    return () => {
      vivo = false
    }
  }, [sub, branchId])

  const soltar = useCallback(() => {
    limpiar(sub)
    setMesa(null)
  }, [sub])

  return { mesa, limpiar: soltar }
}
