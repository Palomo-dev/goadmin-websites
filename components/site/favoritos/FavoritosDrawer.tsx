'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/site/Enlace'
import { useRouter } from 'next/navigation'
import { Heart, LockKeyhole, LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Price } from '@/components/site/CurrencyProvider'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { addProductToCart } from '@/lib/cart'
import { useFavoritos } from '@/lib/favoritos/almacen'
import { estadoFavorito, fichasAgregables, resumenFavoritos, type FavoritoGuardado, type FichaFavorito } from '@/lib/favoritos/logica'
import type { OpcionesFavoritos } from '@/lib/website/v2/cabeceraTienda'
import { CorazonFavorito } from './CorazonFavorito'
import { useFichasFavoritos } from './useFichasFavoritos'

interface FavoritosDrawerProps {
  isOpen: boolean
  onClose: () => void
  primaryColor: string
  organizationSubdomain: string
  branchId?: number | null
  opciones: OpcionesFavoritos
}

/** Línea del carrito de una ficha simple (la misma de las tarjetas: lib/cart.ts). */
export function agregarFichaAlCarrito(subdominio: string, branchId: number | null | undefined, f: FichaFavorito) {
  if (f.precio === null) return
  addProductToCart(subdominio || window.location.hostname.split('.')[0], branchId, {
    id: f.id,
    name: f.nombre,
    price: f.precio,
    sku: f.sku,
    imageUrl: f.imagen,
    comparePrice: f.precioAnterior,
  })
}

/** Segunda línea de la fila: variantes, «Agotado» o «Quedan N» (Figma 2763:61079). */
function DetalleFila({ ficha, guardado }: { ficha: FichaFavorito; guardado?: FavoritoGuardado }) {
  const e = estadoFavorito(ficha, guardado)
  if (e.accion === 'agotado') return <p className="text-xs font-medium text-amber-700">Agotado</p>
  if (e.quedan !== null) return <p className="text-xs font-medium text-amber-700">{e.quedan === 1 ? 'Queda 1' : `Quedan ${e.quedan}`}</p>
  if (ficha.esPadre && ficha.variantes) return <p className="text-xs text-gray-500">{ficha.variantes} {ficha.variantes === 1 ? 'modelo' : 'modelos'}</p>
  if (e.bajoPrecio) return <p className="text-xs font-medium text-green-700">Bajó de precio</p>
  return null
}

/** Botón de la fila: Agregar, Elegir o Agotado. */
export function BotonAccionFavorito({
  ficha,
  primaryColor,
  onAgregar,
  onElegir,
  tamano = 'sm',
}: {
  ficha: FichaFavorito
  primaryColor: string
  onAgregar: () => void
  onElegir: () => void
  tamano?: 'sm' | 'lg'
}) {
  const [agregado, setAgregado] = useState(false)
  const e = estadoFavorito(ficha)
  const clase = tamano === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 w-full text-sm'
  if (e.accion === 'agotado' || e.accion === 'no_disponible') {
    return (
      <span className={`inline-flex items-center justify-center rounded-md bg-gray-100 font-medium text-gray-500 ${clase}`}>
        {e.accion === 'agotado' ? 'Agotado' : 'No disponible'}
      </span>
    )
  }
  return (
    <Button
      type="button"
      size="sm"
      className={`${clase} font-semibold text-white`}
      style={{ backgroundColor: primaryColor }}
      onClick={() => {
        if (e.accion === 'elegir') return onElegir()
        onAgregar()
        setAgregado(true)
        setTimeout(() => setAgregado(false), 1500)
      }}
    >
      {e.accion === 'elegir' ? 'Elegir' : agregado ? 'Agregado ✓' : 'Agregar'}
    </Button>
  )
}

/**
 * Panel lateral de favoritos (Figma 2767:61943 · 2767:62277 · 2767:62522 · 2767:62632 · 2767:62763):
 * mismo estilo, orden y espacio de botones que el cajón del carrito (CartDrawer). En el celular,
 * pantalla completa.
 */
export function FavoritosDrawer({ isOpen, onClose, primaryColor, organizationSubdomain, branchId, opciones }: FavoritosDrawerProps) {
  const { ruta } = useRutaSitio()
  const router = useRouter()
  const { items, sesion, listo } = useFavoritos()
  const ids = items.map((f) => f.productId)
  const { fichas, cargando } = useFichasFavoritos(ids, { sede: branchId ?? null, activo: isOpen })
  const porId = new Map(items.map((f) => [f.productId, f]))
  const resumen = resumenFavoritos(fichas)

  // El chat flotante no tapa los botones del panel (misma regla que el carrito, app/globals.css).
  useEffect(() => {
    if (!isOpen) return
    const raiz = document.documentElement
    raiz.setAttribute('data-favoritos-abierto', '')
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', alTecla)
    return () => {
      raiz.removeAttribute('data-favoritos-abierto')
      window.removeEventListener('keydown', alTecla)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null
  const vacio = listo && items.length === 0
  const irA = (href: string) => {
    onClose()
    router.push(ruta(href))
  }
  const agregarTodo = () => {
    const lista = fichasAgregables(fichas)
    // Primero se cierra el panel: así el carrito se abre solo al sumar (OrganizationLayoutCliente).
    onClose()
    for (const f of lista) agregarFichaAlCarrito(organizationSubdomain, branchId, f)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 transition-opacity" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-panel-favoritos"
        data-panel-favoritos=""
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300 dark:bg-gray-900 sm:max-w-md"
      >
        <div className="flex items-center justify-between border-b p-4 dark:border-gray-700">
          <h2 id="titulo-panel-favoritos" className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <Heart className="h-5 w-5" aria-hidden="true" />
            {opciones.textos.tituloPanel}
            {items.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: primaryColor }}>
                {items.length}
              </span>
            )}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {!sesion && listo && !vacio && opciones.avisoSesion && (
          <div className="border-b px-4 py-3 dark:border-gray-700" style={{ backgroundColor: `${primaryColor}0F` }} data-aviso-sesion="">
            <p className="flex gap-2 text-sm text-gray-800 dark:text-gray-200">
              <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{opciones.textos.avisoSesion}</span>
            </p>
            <Link
              href={ruta('/auth')}
              onClick={onClose}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-sm font-semibold dark:bg-gray-900"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Iniciar sesión
            </Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {vacio ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center" data-favoritos-vacio="">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${primaryColor}14`, color: primaryColor }}>
                <Heart className="h-7 w-7" aria-hidden="true" />
              </span>
              <p className="font-semibold text-gray-900 dark:text-white">{opciones.textos.vacioTitulo}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{opciones.textos.vacioTexto}</p>
            </div>
          ) : cargando || !listo ? (
            <ul className="space-y-3" aria-busy="true">
              {Array.from({ length: Math.min(4, Math.max(1, items.length)) }).map((_, i) => (
                <li key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {fichas.map((f) => (
                <li key={f.id} className="flex gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50" data-fila-favorito={f.id}>
                  <Link href={ruta(`/productos/${f.uuid ?? f.id}`)} onClick={onClose} className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: `${primaryColor}10` }}>
                    {f.imagen ? <img src={f.imagen} alt={f.nombre} className="h-full w-full object-cover" /> : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={ruta(`/productos/${f.uuid ?? f.id}`)} onClick={onClose} className="line-clamp-2 text-sm font-semibold text-gray-900 hover:underline dark:text-white">
                      {f.nombre}
                    </Link>
                    <DetalleFila ficha={f} guardado={porId.get(f.id)} />
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                      {f.precioAnterior !== null && f.precio !== null && f.precioAnterior > f.precio && (
                        <Price value={f.precioAnterior} className="text-xs text-gray-400 line-through" />
                      )}
                      {f.precio !== null && <Price value={f.precio} className="text-sm font-bold" style={{ color: primaryColor }} />}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end justify-between gap-2">
                    <CorazonFavorito productId={f.id} precio={f.precio} variante="plano" />
                    <BotonAccionFavorito
                      ficha={f}
                      primaryColor={primaryColor}
                      onAgregar={() => agregarFichaAlCarrito(organizationSubdomain, branchId, f)}
                      onElegir={() => irA(`/productos/${f.uuid ?? f.id}`)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 dark:border-gray-700" data-pie-favoritos="">
          {vacio ? (
            <div className="flex flex-col gap-2.5">
              <Button asChild className="h-12 w-full text-base font-semibold" style={{ backgroundColor: primaryColor }}>
                <Link href={ruta('/productos')} onClick={onClose}>
                  Explorar productos
                </Link>
              </Button>
              <button type="button" onClick={onClose} className="w-full py-1 text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                Seguir comprando
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                <span>
                  {resumen.productos} {resumen.productos === 1 ? 'producto' : 'productos'} · {resumen.disponibles} {resumen.disponibles === 1 ? 'disponible' : 'disponibles'}
                </span>
                <Price value={resumen.suma} />
              </div>
              <div className="flex flex-col gap-2.5 pt-1">
                <Button
                  type="button"
                  className="h-12 w-full text-base font-semibold"
                  style={{ backgroundColor: primaryColor }}
                  disabled={resumen.agregables === 0}
                  onClick={agregarTodo}
                  data-boton-favoritos="principal"
                >
                  {opciones.textos.botonPrincipal}
                </Button>
                <Button asChild variant="outline" className="h-11 w-full font-semibold dark:border-gray-600 dark:text-white">
                  <Link href={ruta('/favoritos')} onClick={onClose} data-boton-favoritos="secundario">
                    {opciones.textos.botonBorde}
                  </Link>
                </Button>
                <button type="button" onClick={onClose} className="w-full py-1 text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  Seguir comprando
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
