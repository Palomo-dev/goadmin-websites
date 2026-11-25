'use client'

import { MonedaEncabezado } from '@/components/site/header/HeaderShared'
import { VolverCabecera } from '@/components/site/volver/VolverCabecera'
import type { DestinoPadre, Miga } from '@/lib/navegacion/volver'
import { EncabezadoPieProvider, VALOR_POR_DEFECTO } from '@/components/site/EncabezadoPieContext'
import { opcionesEncabezadoPie } from '@/lib/website/encabezadoPie'
import {
  CLASE_FONDO_ENCABEZADO,
  estiloDivisor,
  headerBgStyle,
  variablesEncabezado,
} from '@/components/site/header/HeaderShared'
import { encabezadoUsaLogoClaro, logoSegunFondo } from '@/lib/website/presentacionTienda'
import type { WebsiteSettings } from '@/types/database'

/**
 * Barra del checkout: el mismo fondo, texto, divisor y logo que el encabezado
 * de la tienda. Antes era blanca con el logo principal fijo.
 */
export function CheckoutEncabezado({
  settings,
  logoUrl,
  logoClaroUrl,
  logoFondoClaroUrl,
  nombre,
  primaryColor,
  migas,
  padre,
}: {
  settings: WebsiteSettings | null
  logoUrl: string | null
  logoClaroUrl: string | null
  /** Versión de color. Solo se usa si la barra queda sobre un fondo claro. */
  logoFondoClaroUrl: string | null
  nombre: string
  primaryColor: string
  /** «Inicio › Carrito › Finalizar compra» (con el prefijo de la sede ya puesto). */
  migas: readonly Miga[]
  /** A dónde vuelve el ← si no hay de dónde volver (el carrito). */
  padre: DestinoPadre
}) {
  // En el celular, junto al ←, la miga más útil: la anterior a la página actual («Carrito»).
  const migaCelular = [...migas].reverse().find((m) => m.href) ?? null
  const fondoOscuro = encabezadoUsaLogoClaro(settings?.header_bg_color, false)
  const logo = logoSegunFondo(logoUrl, logoClaroUrl, logoFondoClaroUrl, fondoOscuro)

  return (
    <header
      className={`${CLASE_FONDO_ENCABEZADO} py-2 md:py-3 px-4`}
      style={{ ...headerBgStyle(settings), ...variablesEncabezado(settings), ...estiloDivisor(settings, 'bottom') }}
    >
      {/* Tres columnas: los lados del mismo ancho para que el logo quede en el centro (también a 390 px). */}
      <div className="container mx-auto grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:gap-4">
        {/* UNA sola forma de volver (el dueño, 2026-11-25): en la cabecera, el ← cuadrado de la tienda
            (BotonVolver) y las migas; la página ya no pinta el bloque «Finalizar compra». Celular:
            ← + «Carrito». */}
        <VolverCabecera migas={migas} padre={padre} migaCelular={migaCelular} primaryColor={primaryColor} className="justify-self-start" />
        <div className="flex items-center gap-2">
          {logo && <img src={logo} alt={nombre} className="h-8 md:h-12 w-auto" />}
          {!logo && <span className="font-semibold text-current text-sm md:text-lg">{nombre}</span>}
        </div>
        <div className="flex min-w-0 items-center justify-self-end gap-2 md:gap-3">
          {/* La MISMA moneda de la cabecera de la tienda (MonedaEncabezado) con la configuración del
              editor: estilo, bandera, flecha, monedas habilitadas y «Mostrar moneda». Sin el layout
              de la tienda, el proveedor lleva aquí las mismas opciones del encabezado. */}
          <EncabezadoPieProvider value={{ ...VALOR_POR_DEFECTO, opciones: opcionesEncabezadoPie(settings as Record<string, unknown> | null) }}>
            <span className="hidden md:block">
              <MonedaEncabezado settings={settings} primaryColor={primaryColor} />
            </span>
            <span className="md:hidden">
              <MonedaEncabezado settings={settings} primaryColor={primaryColor} isMobile movilEnBarra />
            </span>
          </EncabezadoPieProvider>
          {/* «Pago seguro»: a 390 px solo el candado (con su texto para lectores y al pasar), para que
              la moneda quepa a la derecha y el logo siga centrado; desde sm, el texto como siempre. */}
          <div className="flex shrink-0 items-center gap-1 text-[10px] md:text-xs text-current opacity-70" title="Pago seguro">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3.5 md:h-3.5" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span className="sr-only sm:not-sr-only">Pago seguro</span>
          </div>
        </div>
      </div>
    </header>
  )
}
