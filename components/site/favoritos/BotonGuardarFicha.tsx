'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { alternarFavoritoTienda, useFavoritos } from '@/lib/favoritos/almacen'
import { useOpcionesTienda } from '@/components/site/OpcionesTiendaContext'
import { BotonAccionFicha } from '@/components/site/ficha/BotonAccionFicha'
import type { EstiloAccionFicha, TamanoAccionFicha } from '@/lib/website/v2/accionesFicha'
import { ROJO_FAVORITO } from './CorazonFavorito'

/**
 * Favorito de la ficha del producto (Figma 2779:65882, Tipo «Favorito»; estados 2780:66065): por
 * defecto el corazón PEQUEÑO cuadrado de 48 px con borde gris, al lado de «Agregar al carrito»;
 * guardado, relleno rojo sobre rosado suave. Con tamaño Largo o Mitad dice «Guardar» / «En
 * favoritos». Se oculta con Encabezado › Favoritos › «Corazón en la ficha» apagado.
 */
export function BotonGuardarFicha({
  productId,
  precio,
  className = '',
  tamano = 'pequeno',
  estilo = 'borde',
  texto,
  textoCelular,
  primaryColor = '#111827',
}: {
  productId: number
  precio?: number | null
  className?: string
  tamano?: TamanoAccionFicha
  estilo?: EstiloAccionFicha
  /** Texto propio del editor (Largo o Mitad). Sin él, «Guardar». */
  texto?: string
  /** Celular con la fila compartida: el texto corto. */
  textoCelular?: string | null
  primaryColor?: string
}) {
  const { favoritos } = useOpcionesTienda()
  const { items } = useFavoritos()
  const [latido, setLatido] = useState(0)
  if (!favoritos.corazonFicha) return null
  const marcado = items.some((f) => f.productId === productId)
  return (
    <BotonAccionFicha
      tipo="favorito"
      tamano={tamano}
      estilo={estilo}
      estado={marcado ? 'guardado' : 'normal'}
      texto={marcado ? 'En favoritos' : texto || 'Guardar'}
      textoCelular={marcado ? null : textoCelular}
      etiqueta={marcado ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      ariaPressed={marcado}
      primaryColor={primaryColor}
      className={className}
      dataAccion="favorito"
      onClick={() => {
        if (!marcado) setLatido((n) => n + 1)
        void alternarFavoritoTienda(productId, { precio: precio ?? null })
      }}
      icono={
        <Heart
          key={latido}
          aria-hidden="true"
          data-guardar-ficha={marcado ? 'si' : 'no'}
          className={`h-5 w-5 shrink-0 ${latido > 0 && marcado ? 'latido-favorito' : ''}`}
          style={marcado ? { color: ROJO_FAVORITO, fill: ROJO_FAVORITO } : undefined}
        />
      }
    />
  )
}
