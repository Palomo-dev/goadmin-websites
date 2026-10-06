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

// Namespace a propósito: este módulo lo importan también rutas del servidor (por el contrato
// `refMesaDeUrl`); con importaciones con nombre de hooks, Next rechaza el build del servidor.
// El hook solo se ejecuta en el navegador. Lo puro vive en ./mesaQR.ts.
import * as React from 'react'
import { DURACION_MESA_MS, guardarMesa, leerMesaGuardada, limpiar, refMesaDeUrl, type MesaGuardada } from './mesaQR'

export * from './mesaQR'

interface RespuestaResolver {
  ok: boolean
  mesa?: { id: string; nombre: string; zona: string | null; sede: number; nombreSede: string | null }
  /** QR de una mesa de otra sede leído en el sitio principal: carta de esa sede con la mesa. */
  redirigir?: string
}

/** Solo rutas del mismo sitio (`/sede/menu?…`) o `https://` (dominio propio de la sede). */
function destinoSeguro(url: unknown): string | null {
  if (typeof url !== 'string') return null
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return /^https:\/\/[a-z0-9.-]+\/menu\?mesa=/i.test(url) ? url : null
}

/**
 * Hook de la carta: lee `?mesa=` / `?table=`, lo valida en el servidor y guarda la mesa. Sin
 * parámetro, devuelve la mesa ya guardada para esta sede. Con un id inválido, limpia y no hay mesa.
 */
export function useMesaQR(subdomain: string, branchId?: number | null): {
  mesa: MesaGuardada | null
  limpiar: () => void
} {
  const [mesa, setMesa] = React.useState<MesaGuardada | null>(null)
  const sub = subdomain || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '')

  React.useEffect(() => {
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
        const destino = destinoSeguro(res.redirigir)
        if (destino) {
          // La mesa es de otra sede: su carta, su carrito y su precio. Allí se vuelve a validar.
          window.location.replace(destino)
          return
        } else if (res.redirigir) {
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

  const soltar = React.useCallback(() => {
    limpiar(sub)
    setMesa(null)
  }, [sub])

  return { mesa, limpiar: soltar }
}
