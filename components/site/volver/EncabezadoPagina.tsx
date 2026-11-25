'use client'

/**
 * Encabezado de página de la tienda en escritorio (Figma 2992:74983, «Tienda/Encabezado de
 * página»): migas de pan arriba y el botón ← cuadrado junto al título. Tipo «ficha»: el título vive
 * en la columna de compra, así que el ← va al inicio de las migas.
 *
 * Tipo «ficha» con `enCelular` (la ficha del producto, pedido del dueño 2026-11-24: «mostrar la
 * ruta completa»): también en el celular, con el ← en 32 px y las migas en una línea que se
 * desliza; esa página no pinta `BarraVolverMovil`. Sin `enCelular` (y en tipo «titulo»), en el
 * celular las migas y el ← no se muestran: los reemplaza `BarraVolverMovil` (si no, salían dos).
 * Las rutas llegan SIN prefijo de sede: aquí se les antepone (`useRutaSitio`).
 */
import Link from '@/components/site/Enlace'
import { ChevronRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { DestinoPadre, Miga } from '@/lib/navegacion/volver'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { BotonVolver } from './BotonVolver'

export function MigasTienda({
  migas,
  className = '',
  heredarColor = false,
}: {
  migas: readonly Miga[]
  className?: string
  /** Dentro de una cabecera (checkout): el color del texto de la cabecera. Sin esto, los grises de siempre. */
  heredarColor?: boolean
}) {
  const { ruta } = useRutaSitio()
  const claseActual = heredarColor ? 'font-medium text-current' : 'font-medium text-slate-900 dark:text-white'
  const claseTexto = heredarColor ? 'text-current opacity-70' : 'text-slate-500 dark:text-gray-400'
  const claseEnlace = heredarColor
    ? 'whitespace-nowrap text-current opacity-75 underline-offset-4 hover:opacity-100 hover:underline'
    : 'whitespace-nowrap text-slate-500 underline-offset-4 hover:text-[var(--volver-miga,currentColor)] hover:underline dark:text-gray-400'
  const claseFlecha = heredarColor ? 'h-3.5 w-3.5 shrink-0 text-current opacity-50' : 'h-3.5 w-3.5 shrink-0 text-slate-400'
  return (
    <nav aria-label="Migas de pan" className={`min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      <ol className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs leading-none md:gap-2 md:text-[13px]">
        {migas.map((m, i) => {
          const ultima = i === migas.length - 1
          return (
            <li key={`${i}-${m.etiqueta}`} className={`flex items-center gap-2 ${ultima ? 'min-w-0' : 'shrink-0'}`}>
              {ultima || !m.href ? (
                <span aria-current={ultima ? 'page' : undefined} className={`truncate ${ultima ? claseActual : claseTexto}`}>
                  {m.etiqueta}
                </span>
              ) : (
                <Link href={ruta(m.href)} className={claseEnlace}>
                  {m.etiqueta}
                </Link>
              )}
              {!ultima && <ChevronRight aria-hidden="true" className={claseFlecha} strokeWidth={1.75} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export interface EncabezadoPaginaProps {
  migas: readonly Miga[]
  padre: DestinoPadre
  primaryColor?: string | null
  /** `titulo` (por defecto): migas arriba y ← junto al título. `ficha`: ← al inicio de las migas. */
  tipo?: 'titulo' | 'ficha'
  titulo?: ReactNode
  /** «24 productos», «Paso 2 de 3 · Envío». */
  detalle?: ReactNode
  /** Botones a la derecha del título (p. ej. «Vaciar carrito»). */
  acciones?: ReactNode
  /** «Mostrar migas de pan» del editor. Sin migas, el ← sigue junto al título. */
  mostrarMigas?: boolean
  preferirUltimaCategoria?: boolean
  /** Tipo «ficha»: también en el celular (la página no pinta `BarraVolverMovil`). */
  enCelular?: boolean
  className?: string
}

export function EncabezadoPagina({
  migas,
  padre,
  primaryColor,
  tipo = 'titulo',
  titulo,
  detalle,
  acciones,
  mostrarMigas = true,
  preferirUltimaCategoria,
  enCelular = false,
  className = '',
}: EncabezadoPaginaProps) {
  const estiloMiga = primaryColor ? ({ ['--volver-miga' as string]: primaryColor } as CSSProperties) : undefined
  const boton = <BotonVolver padre={padre} primaryColor={primaryColor} preferirUltimaCategoria={preferirUltimaCategoria} />

  if (tipo === 'ficha') {
    return (
      <div className={`${enCelular ? 'flex' : 'hidden md:flex'} items-center gap-2 md:gap-3 ${className}`} style={estiloMiga} data-encabezado-pagina="ficha">
        <BotonVolver compacto padre={padre} primaryColor={primaryColor} preferirUltimaCategoria={preferirUltimaCategoria} />
        {mostrarMigas && <MigasTienda migas={migas} />}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-3.5 ${className}`} style={estiloMiga} data-encabezado-pagina="titulo">
      {mostrarMigas && <MigasTienda migas={migas} className="hidden md:block" />}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1">
          <span className="hidden md:inline-flex">{boton}</span>
          {titulo && <h1 className="min-w-0 text-2xl font-bold text-slate-900 md:text-[30px] md:leading-tight dark:text-white">{titulo}</h1>}
          {detalle && <p className="text-sm text-slate-500 md:text-[15px] dark:text-gray-400">{detalle}</p>}
        </div>
        {acciones}
      </div>
    </div>
  )
}
