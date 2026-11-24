'use client'

import Link from '@/components/site/Enlace'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { estadoFavorito, type FavoritoGuardado, type FichaFavorito } from '@/lib/favoritos/logica'
import { CorazonFavorito } from './CorazonFavorito'
import { agregarFichaAlCarrito } from './FavoritosDrawer'
import { InsigniaVolumenTarjeta, LineaVolumenTarjeta } from '@/components/site/volumen/VolumenTarjeta'

const INSIGNIAS = {
  bajo_precio: { texto: 'Bajó de precio', clase: 'bg-green-600 text-white' },
  agotado: { texto: 'Agotado', clase: 'bg-gray-500 text-white' },
  pocas: { texto: 'Pocas unidades', clase: 'bg-amber-600 text-white' },
} as const

/**
 * Tarjeta de producto de /favoritos y de «También te puede gustar» (Figma 2762:61084): insignia
 * (Bajó de precio · Agotado · Pocas unidades), corazón, categoría, nombre, precio y el botón
 * Agregar / Elegir / Agotado a todo el ancho.
 */
export function TarjetaFavorito({
  ficha,
  guardado,
  primaryColor,
  organizationSubdomain,
  branchId,
}: {
  ficha: FichaFavorito
  guardado?: FavoritoGuardado
  primaryColor: string
  organizationSubdomain: string
  branchId?: number | null
}) {
  const { ruta } = useRutaSitio()
  const router = useRouter()
  const [agregado, setAgregado] = useState(false)
  const e = estadoFavorito(ficha, guardado)
  const href = ruta(`/productos/${ficha.uuid ?? ficha.id}`)
  const insignia = e.insignia ? INSIGNIAS[e.insignia] : null
  const subtitulo = [ficha.categoria, ficha.esPadre && ficha.variantes ? `${ficha.variantes} ${ficha.variantes === 1 ? 'modelo' : 'modelos'}` : null].filter(Boolean).join(' · ')
  const deshabilitado = e.accion === 'agotado' || e.accion === 'no_disponible'
  // Precio por volumen (Figma «16 Sitio web» S3/S4). La ficha guardada no trae marca ni padre:
  // quedan desconocidos y una promoción que los necesite no se promete aquí.
  const productoVolumen = { id: ficha.id, category_id: ficha.categoriaId }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" data-tarjeta-favorito={ficha.id}>
      <div className="relative aspect-[4/3] w-full" style={{ backgroundColor: `${primaryColor}0D` }}>
        <Link href={href} className="block h-full w-full" aria-label={ficha.nombre}>
          {ficha.imagen ? <img src={ficha.imagen} alt="" className={`h-full w-full object-cover ${e.accion === 'agotado' ? 'opacity-60' : ''}`} loading="lazy" /> : null}
        </Link>
        {insignia && (
          <span className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${insignia.clase}`} data-insignia={e.insignia}>
            {insignia.texto}
          </span>
        )}
        <InsigniaVolumenTarjeta product={productoVolumen} price={ficha.precio} primaryColor={primaryColor} abajo={!!insignia} />
        <CorazonFavorito productId={ficha.id} precio={ficha.precio} className="absolute right-2.5 top-2.5" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {subtitulo && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{subtitulo}</p>}
        <Link href={href} className="line-clamp-2 text-sm font-semibold text-gray-900 hover:underline dark:text-white">
          {ficha.nombre}
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-2">
          {ficha.precio !== null && <Price value={ficha.precio} className="text-base font-bold" style={{ color: primaryColor }} />}
          {ficha.precioAnterior !== null && ficha.precio !== null && ficha.precioAnterior > ficha.precio && (
            <Price value={ficha.precioAnterior} className="text-xs text-gray-400 line-through" />
          )}
        </div>
        <LineaVolumenTarjeta product={productoVolumen} price={ficha.precio} primaryColor={primaryColor} />
        <div className="mt-auto pt-2">
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => {
              if (e.accion === 'elegir') return router.push(href)
              agregarFichaAlCarrito(organizationSubdomain, branchId, ficha)
              setAgregado(true)
              setTimeout(() => setAgregado(false), 1500)
            }}
            className={`flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition-opacity ${deshabilitado ? 'cursor-not-allowed bg-gray-100 text-gray-500 dark:bg-gray-800' : 'text-white hover:opacity-90'}`}
            style={deshabilitado ? undefined : { backgroundColor: primaryColor }}
          >
            {!deshabilitado && <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
            {e.accion === 'agotado' ? 'Agotado' : e.accion === 'no_disponible' ? 'No disponible' : e.accion === 'elegir' ? 'Elegir' : agregado ? 'Agregado ✓' : 'Agregar'}
          </button>
        </div>
      </div>
    </article>
  )
}
