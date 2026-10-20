'use client'

import { CurrencySelector } from '@/components/site/CurrencySelector'
import {
  CLASE_FONDO_ENCABEZADO,
  estiloDivisor,
  headerBgStyle,
  variablesEncabezado,
} from '@/components/site/header/HeaderShared'
import { elegirLogo, encabezadoUsaLogoClaro } from '@/lib/website/presentacionTienda'
import type { WebsiteSettings } from '@/types/database'

/**
 * Barra del checkout: el mismo fondo, texto, divisor y logo que el encabezado
 * de la tienda. Antes era blanca con el logo principal fijo.
 */
export function CheckoutEncabezado({
  settings,
  logoUrl,
  logoClaroUrl,
  nombre,
  primaryColor,
  hrefInicio,
}: {
  settings: WebsiteSettings | null
  logoUrl: string | null
  logoClaroUrl: string | null
  nombre: string
  primaryColor: string
  hrefInicio: string
}) {
  const fondoOscuro = encabezadoUsaLogoClaro(settings?.header_bg_color, false)
  const logo = elegirLogo(logoUrl, logoClaroUrl, fondoOscuro)

  return (
    <header
      className={`${CLASE_FONDO_ENCABEZADO} py-2 md:py-3 px-4`}
      style={{ ...headerBgStyle(settings), ...variablesEncabezado(settings), ...estiloDivisor(settings, 'bottom') }}
    >
      <div className="container mx-auto flex items-center justify-between">
        <a href={hrefInicio} className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-current opacity-80 hover:opacity-100 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-4 md:h-4"><path d="m15 18-6-6 6-6"/></svg>
          Seguir comprando
        </a>
        <div className="flex items-center gap-2">
          {logo && <img src={logo} alt={nombre} className="h-8 md:h-12 w-auto" />}
          {!logo && <span className="font-semibold text-current text-sm md:text-lg">{nombre}</span>}
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <CurrencySelector primaryColor={primaryColor} heredarColor compactClassName="px-1.5 py-1 text-xs md:px-2 md:py-1.5 md:text-sm" />
          <div className="flex items-center gap-1 text-[10px] md:text-xs text-current opacity-70">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3.5 md:h-3.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Pago seguro
          </div>
        </div>
      </div>
    </header>
  )
}
