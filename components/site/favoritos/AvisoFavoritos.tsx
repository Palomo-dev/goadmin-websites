'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { EVENTO_AVISO_FAVORITOS, abrirPanelFavoritos, restaurarFavorito, type DetalleAvisoFavorito } from '@/lib/favoritos/almacen'
import { useOpcionesTienda } from '@/components/site/OpcionesTiendaContext'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { ROJO_FAVORITO } from './CorazonFavorito'

/** Cuánto dura el aviso (Figma 2767:61793: 4 s, abajo al centro). */
const DURACION_MS = 4000

/**
 * Aviso al marcar y al quitar (Figma 2762:61116): «Agregado a favoritos · Ver favoritos» y
 * «Quitado de favoritos · Deshacer». Escucha `favoritos-aviso` del almacén; uno a la vez.
 */
export function AvisoFavoritos() {
  const [aviso, setAviso] = useState<DetalleAvisoFavorito | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { favoritos } = useOpcionesTienda()
  const router = useRouter()
  const { ruta } = useRutaSitio()

  useEffect(() => {
    const alAviso = (e: Event) => {
      const detalle = (e as CustomEvent<DetalleAvisoFavorito>).detail
      if (!detalle) return
      setAviso(detalle)
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => setAviso(null), DURACION_MS)
    }
    window.addEventListener(EVENTO_AVISO_FAVORITOS, alAviso)
    return () => {
      window.removeEventListener(EVENTO_AVISO_FAVORITOS, alAviso)
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  if (!aviso) return null
  const cerrar = () => setAviso(null)
  const enPagina = typeof window !== 'undefined' && /\/favoritos\/?$/.test(window.location.pathname)
  const texto = aviso.tipo === 'agregado' ? 'Agregado a favoritos' : aviso.tipo === 'quitado' ? 'Quitado de favoritos' : 'No se pudo guardar. Intenta de nuevo.'

  return (
    <div
      role="status"
      aria-live="polite"
      data-aviso-favoritos={aviso.tipo}
      className="aviso-favoritos fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl"
    >
      <Heart aria-hidden="true" className="h-5 w-5 flex-shrink-0" style={aviso.tipo === 'agregado' ? { color: ROJO_FAVORITO, fill: ROJO_FAVORITO } : undefined} />
      <span className="min-w-0 flex-1">{texto}</span>
      {aviso.tipo === 'agregado' && !enPagina && (
        <button
          type="button"
          className="flex-shrink-0 font-semibold text-blue-300 hover:text-blue-200"
          onClick={() => {
            cerrar()
            if (favoritos.alTocar === 'panel') abrirPanelFavoritos()
            else router.push(ruta('/favoritos'))
          }}
        >
          Ver favoritos
        </button>
      )}
      {aviso.tipo === 'quitado' && (
        <button
          type="button"
          className="flex-shrink-0 font-semibold text-blue-300 hover:text-blue-200"
          onClick={() => {
            cerrar()
            void restaurarFavorito(aviso.item)
          }}
        >
          Deshacer
        </button>
      )}
    </div>
  )
}
