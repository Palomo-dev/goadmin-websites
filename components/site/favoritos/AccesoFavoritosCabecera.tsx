'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { abrirPanelFavoritos, useFavoritos } from '@/lib/favoritos/almacen'
import { useOpcionesTienda } from '@/components/site/OpcionesTiendaContext'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { contadorFavoritos } from '@/lib/website/v2/cabeceraTienda'

/**
 * Contador de favoritos guardados (Figma 2762:61083): el número con «99+», visible solo con el
 * contador encendido (`header_favoritos.contador`) y rebota al sumar uno. Lo usan el corazón de la
 * cabecera y el botón «Favoritos» del menú inferior. Sin favoritos, nada. Es solo visual: quien lo
 * usa dice la cantidad en su aria-label.
 */
export function ContadorFavoritos({
  primaryColor,
  className = 'absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white',
}: {
  primaryColor: string
  className?: string
}) {
  const { favoritos } = useOpcionesTienda()
  const { items } = useFavoritos()
  const texto = contadorFavoritos(items.length, favoritos.contador)
  const anterior = useRef(items.length)
  const [rebote, setRebote] = useState(0)
  useEffect(() => {
    if (items.length > anterior.current) setRebote((n) => n + 1)
    anterior.current = items.length
  }, [items.length])
  if (!texto) return null
  return (
    <span
      key={rebote}
      aria-hidden="true"
      data-contador-favoritos=""
      className={`${className} ${rebote > 0 ? 'rebote-contador-favoritos' : ''}`}
      style={{ backgroundColor: primaryColor }}
    >
      {texto}
    </span>
  )
}

/**
 * Corazón de la cabecera (Figma 2762:61083 · 2772:62317). Envuelve el ícono que ya pinta la
 * cabecera (estilo de Encabezado › Íconos) y decide qué hace al tocarlo según Encabezado ›
 * Favoritos: abrir el panel lateral (por defecto) o ir a /favoritos. Con el contador encendido
 * muestra cuántos hay guardados y rebota al sumar uno.
 */
export function AccesoFavoritosCabecera({
  className,
  ariaLabel,
  primaryColor,
  children,
}: {
  className: string
  ariaLabel?: string
  primaryColor: string
  children: ReactNode
}) {
  const { favoritos } = useOpcionesTienda()
  const { ruta } = useRutaSitio()
  const { items } = useFavoritos()
  const texto = contadorFavoritos(items.length, favoritos.contador)
  const contador = <ContadorFavoritos primaryColor={primaryColor} />
  const etiqueta = ariaLabel ? (texto ? `${ariaLabel} (${items.length})` : ariaLabel) : undefined
  const clase = `relative ${className}`

  if (favoritos.alTocar === 'pagina') {
    return (
      <Link href={ruta('/favoritos')} aria-label={etiqueta} className={clase} data-favoritos-cabecera="pagina">
        {children}
        {contador}
      </Link>
    )
  }
  return (
    <button type="button" onClick={abrirPanelFavoritos} aria-label={etiqueta} aria-haspopup="dialog" className={clase} data-favoritos-cabecera="panel">
      {children}
      {contador}
    </button>
  )
}
