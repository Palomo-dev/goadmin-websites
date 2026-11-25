'use client'

import { useState } from 'react'
import Link from '@/components/site/Enlace'
import { ChevronRight, Heart, LockKeyhole, LogIn, Share2, ShoppingCart } from 'lucide-react'
import { useOpcionesTienda } from '@/components/site/OpcionesTiendaContext'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { useFavoritos } from '@/lib/favoritos/almacen'
import {
  ETIQUETAS_ORDEN_FAVORITOS,
  ORDENES_FAVORITOS,
  fichasAgregables,
  ordenValido,
  ordenarFichas,
  type OrdenFavoritos,
} from '@/lib/favoritos/logica'
import { EnlaceIniciarSesion } from '@/components/site/cuenta/EnlaceIniciarSesion'
import { agregarFichaAlCarrito } from './FavoritosDrawer'
import { TarjetaFavorito } from './TarjetaFavorito'
import { useFichasFavoritos } from './useFichasFavoritos'

interface FavoritosPaginaProps {
  primaryColor: string
  organizationSubdomain: string
  branchId?: number | null
  /** Lista compartida (`?lista=` o `?ids=`): sus productos en vez de los del visitante. */
  compartidos?: number[] | null
  /** El enlace compartido ya no existe o caducó. */
  listaNoDisponible?: boolean
}

/**
 * Página pública /favoritos (Figma 2764:61164 escritorio · 2766:61407 vacío · 2766:61538 celular ·
 * 2766:61823 celular vacío): ordenar, «Agregar todo al carrito (N)», «Compartir lista», insignias,
 * «También te puede gustar» y, en el celular, 2 columnas con la barra fija abajo.
 */
export function FavoritosPagina({ primaryColor, organizationSubdomain, branchId = null, compartidos = null, listaNoDisponible = false }: FavoritosPaginaProps) {
  const { favoritos: opciones } = useOpcionesTienda()
  const { ruta } = useRutaSitio()
  const { items, sesion, listo } = useFavoritos()
  const [orden, setOrden] = useState<OrdenFavoritos>('recientes')
  const [compartir, setCompartir] = useState<'' | 'enviando' | 'copiado' | 'error'>('')

  const esCompartida = compartidos !== null
  const ids = esCompartida ? compartidos : items.map((f) => f.productId)
  const { fichas, sugerencias, cargando } = useFichasFavoritos(ids, {
    sede: branchId,
    sugerencias: opciones.sugerencias.mostrar ? opciones.sugerencias.fuente : null,
    activo: esCompartida || listo,
  })
  const porId = new Map(items.map((f) => [f.productId, f]))
  const ordenadas = ordenarFichas(fichas, orden, esCompartida ? [] : items)
  const agregables = fichasAgregables(fichas)
  const vacio = !cargando && (esCompartida ? fichas.length === 0 : listo && items.length === 0)
  const titulo = esCompartida ? 'Lista compartida' : opciones.textos.tituloPagina
  const total = esCompartida ? fichas.length : items.length

  const agregarTodo = () => {
    for (const f of agregables) agregarFichaAlCarrito(organizationSubdomain, branchId, f)
  }

  const compartirLista = async () => {
    setCompartir('enviando')
    try {
      const r = await fetch('/api/favorites/compartir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids }),
      })
      const datos = (await r.json()) as { ruta?: string }
      if (!r.ok || !datos.ruta) throw new Error('sin ruta')
      const url = `${window.location.origin}${ruta(datos.ruta)}`
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: titulo, url })
          setCompartir('')
          return
        } catch {
          // Cancelado o no permitido: se copia el enlace.
        }
      }
      await navigator.clipboard.writeText(url)
      setCompartir('copiado')
      setTimeout(() => setCompartir(''), 3000)
    } catch {
      setCompartir('error')
      setTimeout(() => setCompartir(''), 3000)
    }
  }

  const botonAgregarTodo = (clase: string) => (
    <button
      type="button"
      onClick={agregarTodo}
      disabled={agregables.length === 0}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${clase}`}
      style={{ backgroundColor: primaryColor }}
      data-agregar-todo=""
    >
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      {opciones.textos.botonPrincipal} ({agregables.length})
    </button>
  )

  return (
    <div className={`container mx-auto px-4 py-6 md:py-8 ${!vacio && agregables.length > 0 ? 'pb-28 md:pb-8' : ''}`} data-pagina-favoritos={esCompartida ? 'compartida' : 'propia'}>
      <nav aria-label="Migas" className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link href={ruta('/')} className="hover:underline">
          Inicio
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-gray-900 dark:text-white">Favoritos</span>
      </nav>
      <h1 className="mb-5 text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
        {titulo}
        {total > 0 && ` (${total})`}
      </h1>

      {listaNoDisponible && (
        <p role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este enlace de favoritos ya no está disponible. Te mostramos tus favoritos.
        </p>
      )}

      {!esCompartida && listo && !sesion && !vacio && opciones.avisoSesion && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: `${primaryColor}33`, backgroundColor: `${primaryColor}0D` }} data-aviso-sesion="">
          <p className="flex gap-2 text-sm text-gray-800 dark:text-gray-200">
            <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {opciones.textos.avisoSesion}
          </p>
          {/* La regla de la cabecera (reglaAcceso.ts); al entrar, de vuelta en /favoritos. */}
          <EnlaceIniciarSesion
            className="inline-flex flex-shrink-0 items-center gap-1.5 self-start rounded-md border bg-white px-3 py-1.5 text-sm font-semibold dark:bg-gray-900 sm:self-auto"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Iniciar sesión
          </EnlaceIniciarSesion>
        </div>
      )}

      {vacio ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-50 px-6 py-14 text-center dark:bg-gray-800/50" data-favoritos-vacio="">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${primaryColor}14`, color: primaryColor }}>
            <Heart className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{opciones.textos.vacioTitulo}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{opciones.textos.vacioTexto}</p>
          <Link href={ruta('/productos')} className="mt-5 inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold text-white" style={{ backgroundColor: primaryColor }}>
            Explorar productos
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="hidden sm:inline">Ordenar por</span>
              <select
                value={orden}
                onChange={(e) => setOrden(ordenValido(e.target.value))}
                aria-label="Ordenar por"
                className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                {ORDENES_FAVORITOS.map((o) => (
                  <option key={o} value={o}>
                    {ETIQUETAS_ORDEN_FAVORITOS[o]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              {opciones.compartir && fichas.length > 0 && (
                <button
                  type="button"
                  onClick={compartirLista}
                  disabled={compartir === 'enviando'}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  {compartir === 'copiado' ? 'Enlace copiado' : compartir === 'error' ? 'No se pudo compartir' : (
                    <>
                      <span className="sm:hidden">Compartir</span>
                      <span className="hidden sm:inline">Compartir lista</span>
                    </>
                  )}
                </button>
              )}
              {botonAgregarTodo('hidden h-9 text-sm md:inline-flex')}
            </div>
          </div>

          {cargando && fichas.length === 0 ? (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4" aria-busy="true">
              {Array.from({ length: Math.min(8, Math.max(2, ids.length)) }).map((_, i) => (
                <li key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {ordenadas.map((f) => (
                <li key={f.id}>
                  <TarjetaFavorito ficha={f} guardado={porId.get(f.id)} primaryColor={primaryColor} organizationSubdomain={organizationSubdomain} branchId={branchId} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {opciones.sugerencias.mostrar && sugerencias.length > 0 && (
        <section className="mt-10" aria-labelledby="titulo-sugerencias-favoritos" data-sugerencias-favoritos="">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="titulo-sugerencias-favoritos" className="text-lg font-bold text-gray-900 dark:text-white">
              También te puede gustar
            </h2>
            <Link href={ruta('/productos')} className="text-sm font-semibold hover:underline" style={{ color: primaryColor }}>
              Ver más
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {sugerencias.map((f) => (
              <li key={f.id}>
                <TarjetaFavorito ficha={f} primaryColor={primaryColor} organizationSubdomain={organizationSubdomain} branchId={branchId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Celular: barra fija con «Agregar todo al carrito (N)» (Figma 2766:61538). */}
      {!vacio && agregables.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 dark:border-gray-700 dark:bg-gray-900 md:hidden" data-barra-favoritos="">
          {botonAgregarTodo('h-12 w-full text-base')}
        </div>
      )}
    </div>
  )
}
