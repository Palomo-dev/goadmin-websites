'use client'

/**
 * Fila «Favoritos» del menú lateral del celular (Figma «16 Sitio web» 2832:68496, G2): en el
 * celular el corazón no va en la barra de arriba (en 390 px ya lleva menú, logo, buscar y
 * carrito), sino aquí. Solo si el sitio prendió el corazón (`header_iconos.favoritos`) y vende
 * productos. Al tocarla, lo mismo que el corazón: el panel lateral o /favoritos (Encabezado ›
 * Favoritos), con el contador.
 */
import Link from 'next/link'
import { ChevronRight, Heart } from 'lucide-react'
import { abrirPanelFavoritos, useFavoritos } from '@/lib/favoritos/almacen'
import { useOpcionesTienda } from '@/components/site/OpcionesTiendaContext'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { contadorFavoritos, opcionesIconos, textoIcono } from '@/lib/website/v2/cabeceraTienda'

export function FilaFavoritosMenu({
  settings,
  visible = true,
  className,
  onNavigate,
}: {
  settings: unknown
  /** La tienda vende productos (el carrito está activo). */
  visible?: boolean
  className: string
  onNavigate: () => void
}) {
  const { favoritos } = useOpcionesTienda()
  const { ruta } = useRutaSitio()
  const { items } = useFavoritos()
  const op = opcionesIconos(settings as Record<string, unknown> | null)
  if (!visible || !op.favoritos) return null
  const texto = textoIcono(op, 'favoritos')
  const contador = contadorFavoritos(items.length, favoritos.contador)
  const contenido = (
    <>
      <Heart aria-hidden="true" className="h-5 w-5 shrink-0" />
      <span className="flex-1">{texto}</span>
      {contador && (
        <span className="rounded-full px-1.5 text-xs font-semibold text-white" style={{ backgroundColor: 'var(--primary-color)' }}>
          {contador}
        </span>
      )}
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60" />
    </>
  )
  if (favoritos.alTocar === 'pagina') {
    return (
      <Link href={ruta('/favoritos')} className={className} onClick={onNavigate} data-fila-favoritos="pagina">
        {contenido}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      data-fila-favoritos="panel"
      onClick={() => {
        onNavigate()
        window.setTimeout(abrirPanelFavoritos, 0)
      }}
    >
      {contenido}
    </button>
  )
}
