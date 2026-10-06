'use client'

/**
 * Barra fija móvil del restaurante (Figma «Celular: carta y hoja del plato» y componente
 * «Reservar · Llamar · Cómo llegar · Pedir»): «Reservar» (primaria) · «Cómo llegar» · «Pedir».
 *
 * Las acciones las decide el servidor (lib/outlet/sedeLayout.ts):
 * - «Pedir» solo con el pedido en línea activo, a la página de la carta;
 * - «Reservar» solo si alguna sede acepta reservas web y hay página de reserva;
 * - «Cómo llegar» con la dirección o las coordenadas de la sede actual.
 * Sin ninguna acción no se pinta. Solo en móvil (`md:hidden`), con espacio para el área
 * segura del iPhone y un espaciador para no tapar el pie.
 */

import Link from 'next/link'
import { CalendarDays, Navigation, ShoppingBag } from 'lucide-react'
import type { AccionesBarraMovil } from '@/lib/outlet/sedeLayout'

/** Rutas con barra inferior propia o donde la barra estorba (checkout, carrito, detalle, pedido). */
const RUTAS_SIN_BARRA = ['/checkout', '/carrito', '/productos/', '/pedido/', '/mi-cuenta', '/auth']

/** `pathname` sin el prefijo de sede. */
export function rutaConBarraMovil(pathname: string): boolean {
  return !RUTAS_SIN_BARRA.some((r) =>
    r.endsWith('/') ? pathname.startsWith(r) : pathname === r || pathname.startsWith(`${r}/`),
  )
}

export function MobileCTABar({ acciones, primaryColor }: { acciones: AccionesBarraMovil; primaryColor: string }) {
  const items = [
    acciones.reservar && { clave: 'reservar', href: acciones.reservar, texto: 'Reservar', Icono: CalendarDays, externo: false },
    acciones.comoLlegar && { clave: 'llegar', href: acciones.comoLlegar, texto: 'Cómo llegar', Icono: Navigation, externo: true },
    acciones.pedir && { clave: 'pedir', href: acciones.pedir, texto: 'Pedir', Icono: ShoppingBag, externo: false },
  ].filter(Boolean) as { clave: string; href: string; texto: string; Icono: typeof CalendarDays; externo: boolean }[]
  if (items.length === 0) return null
  // La acción principal (rellena con el color de la marca): Reservar; si no hay, Pedir.
  const principal = acciones.reservar ? 'reservar' : acciones.pedir ? 'pedir' : null

  return (
    <>
      {/* Espaciador: que la barra no tape el final del pie. */}
      <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden="true" />
      <nav
        aria-label="Acciones rápidas"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-900/95"
      >
        <ul className="mx-auto flex max-w-md items-stretch gap-2">
          {items.map(({ clave, href, texto, Icono, externo }) => {
            const esPrincipal = clave === principal
            const clase = `flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-medium transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              esPrincipal ? 'text-white' : 'text-gray-800 dark:text-gray-100'
            }`
            const estilo = esPrincipal ? { backgroundColor: primaryColor, outlineColor: primaryColor } : { outlineColor: primaryColor }
            const contenido = (
              <>
                <Icono className="h-5 w-5" aria-hidden="true" />
                <span>{texto}</span>
              </>
            )
            return (
              <li key={clave} className="flex flex-1">
                {externo ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={clase} style={estilo}>
                    {contenido}
                    <span className="sr-only"> (abre Google Maps)</span>
                  </a>
                ) : (
                  <Link href={href} className={clase} style={estilo}>
                    {contenido}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
