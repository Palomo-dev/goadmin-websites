'use client'

/**
 * «Volver» del celular: el mismo botón ← cuadrado del computador (con el tono de la tienda), en
 * pequeño (32 px), y al lado, en letra pequeña, a dónde vuelve («Muebles y Salas»).
 *
 * El dueño (2026-11-24) rechazó la barra pegada de 56 px del Figma 2992:75028 y luego pidió que el
 * celular se viera como el computador («me encanta así»: migas + ← cuadrado), pero pequeño y sin
 * estorbar: una sola línea, NO pegada, sin Buscar ni carrito. En el pago no se usa (su cabecera
 * ya tiene «Seguir comprando»).
 *
 * Además registra el nombre de la página («Neveras») para el ← de la página siguiente.
 */
import Link from '@/components/site/Enlace'
import { ChevronLeft } from 'lucide-react'
import { useEffect } from 'react'
import { textoVolver } from '@/lib/navegacion/volver'
import { estiloBotonVolver } from './BotonVolver'
import { registrarEtiqueta } from './rastro'
import { useDestinoVolver, type OpcionesVolver } from './useDestinoVolver'

/** Abre el cajón del carrito (lo escucha OrganizationLayoutCliente). */
export const EVENTO_ABRIR_CARRITO = 'go:abrir-carrito'

export interface BarraVolverMovilProps extends OpcionesVolver {
  /** Nombre de esta página para el ← de la siguiente («Neveras», el nombre del producto). */
  etiquetaActual?: string | null
  primaryColor?: string | null
  /** Se conserva por compatibilidad: ya no toma el color de la cabecera. */
  colorCabecera?: string | null
  /** Se conserva por compatibilidad: ya no muestra Buscar ni carrito. */
  acciones?: { buscar?: boolean; carrito?: { subdominio: string; branchId?: number | null } | null } | null
  className?: string
  /** Solo registra el nombre de la página (la ficha ya pinta ← + migas en el celular). */
  soloRegistrar?: boolean
}

export function BarraVolverMovil({ padre, preferirUltimaCategoria, etiquetaActual, primaryColor, className = '', soloRegistrar = false }: BarraVolverMovilProps) {
  const { href, etiqueta, alPulsar } = useDestinoVolver({ padre, preferirUltimaCategoria })
  const { clase, estilo } = estiloBotonVolver(primaryColor)

  useEffect(() => {
    if (etiquetaActual) registrarEtiqueta(window.location.pathname, etiquetaActual)
  }, [etiquetaActual])

  if (soloRegistrar) return null
  const texto = textoVolver(etiqueta)
  const destino = etiqueta.trim() || 'Atrás'
  return (
    <div className={`px-4 pt-3 md:hidden ${className}`} data-barra-volver="">
      <Link href={href} onClick={alPulsar} aria-label={texto} className="inline-flex max-w-full items-center gap-2" data-boton-volver="">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${clase}`} style={estilo} aria-hidden="true">
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="truncate text-[13px] text-slate-500 dark:text-gray-400" aria-hidden="true">{destino}</span>
      </Link>
    </div>
  )
}
