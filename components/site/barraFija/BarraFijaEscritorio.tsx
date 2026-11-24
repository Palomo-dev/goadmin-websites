'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Check, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AVISO_TOPE_CARRITO } from '@/lib/stock'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { BotonGuardarFicha } from '@/components/site/favoritos/BotonGuardarFicha'
import { HeaderLogo } from '@/components/site/header/HeaderShared'
import { textoBotonConPrecio } from '@/lib/website/v2/contrato/seccionesTienda'
import { textoAgregarConCantidad, type BotonVolumen } from '@/lib/promociones/escalonesTienda'
import {
  barraReemplazaVisible,
  textoBotonBarra,
  type EfectoAgregarBarraFija,
  type EstiloBarraFija,
  type OpcionesBarraEscritorio,
  type PosicionBarraEscritorio,
} from '@/lib/website/v2/barraFija'
import type { OrganizationWithDetails } from '@/types/database'
import type { CompraBarraFija } from './useCompraBarraFija'
import { CantidadCompacta, InfoProductoBarra } from './PartesBarraFija'
import { useCabeceraEscondida, useEmpujeChat, useVisibilidadBarra, volarAlCarrito } from './efectosBarraFija'

/**
 * Barra fija del computador (desde 1024 px; NUEVA, Figma 2858:71472). Apagada por defecto: sin
 * `sticky.desktop.enabled`, la ficha del computador queda como hoy.
 *
 * - D1 `top`: bajo la cabecera, que se queda (la sugerida).
 * - D2 `replace`: al bajar, la cabecera se esconde y la barra ocupa su lugar con el logo; al subir
 *   vuelve la cabecera.
 * - D3 `bottom`: abajo, flotante, separada 24 px; no toca la cabecera y el chat sube sobre ella.
 *
 * Miniatura y nombre, precio, variante compacta (un desplegable por atributo), cantidad,
 * «Agregar al carrito», «Comprar ahora» y corazón, cada uno con su interruptor. La compra (stock,
 * tope, variantes) es la misma de la barra del celular: `useCompraBarraFija`.
 */

/** La cabecera del sitio: el <header> fijo, el envoltorio de «Al bajar» o el del punto de corte. */
const SELECTOR_CABECERA = '[data-raiz-sitio] > header, [data-raiz-sitio] > div.sticky, [data-raiz-sitio] > [data-hdr-bp] > header'

/** Dónde termina la cabecera (para pegar la barra debajo). 0 si no hay o ya se escondió. */
function useBordeCabecera(activo: boolean): number {
  const [borde, setBorde] = useState(0)
  useEffect(() => {
    if (!activo) return
    let pendiente = 0
    const medir = () => {
      pendiente = 0
      const cabecera = document.querySelector(SELECTOR_CABECERA)
      setBorde(cabecera ? Math.max(0, Math.round(cabecera.getBoundingClientRect().bottom)) : 0)
    }
    const programar = () => {
      if (!pendiente) pendiente = window.requestAnimationFrame(medir)
    }
    medir()
    window.addEventListener('scroll', programar, { passive: true })
    window.addEventListener('resize', programar)
    return () => {
      window.removeEventListener('scroll', programar)
      window.removeEventListener('resize', programar)
      if (pendiente) window.cancelAnimationFrame(pendiente)
    }
  }, [activo])
  return borde
}

function clasesFondo(estilo: EstiloBarraFija): string {
  if (estilo === 'glass') return 'border-white/60 bg-white/70 backdrop-blur-md'
  return 'border-gray-200 bg-white'
}

function clasesContenedor(posicion: PosicionBarraEscritorio, estilo: EstiloBarraFija, visible: boolean): string {
  const base = 'fixed hidden transition-[transform,opacity] duration-300 lg:block'
  const fondo = clasesFondo(estilo)
  if (posicion === 'bottom') {
    const sombra = estilo === 'floating' ? 'shadow-[0_12px_40px_rgba(0,0,0,0.22)]' : 'shadow-[0_8px_30px_rgba(0,0,0,0.14)]'
    return `${base} z-50 bottom-6 left-6 right-6 mx-auto max-w-6xl rounded-2xl border ${fondo} ${sombra} ${
      visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+2rem)] opacity-0'
    }`
  }
  // Arriba: bajo la cabecera (z-30, por debajo de ella al esconderse) o en su lugar (z-50).
  const capa = posicion === 'top' ? 'z-30' : 'z-50'
  const forma = estilo === 'floating'
    ? 'left-4 right-4 mx-auto mt-2 max-w-6xl rounded-2xl border shadow-[0_12px_40px_rgba(0,0,0,0.18)]'
    : 'inset-x-0 border-b shadow-[0_4px_16px_rgba(0,0,0,0.08)]'
  return `${base} ${capa} ${forma} ${fondo} ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0'}`
}

export function BarraFijaEscritorio({
  compra,
  op,
  texto,
  alAgregar,
  productId,
  productName,
  price,
  primaryColor,
  conFavorito,
  precioEnBoton,
  organization,
  botonVolumen = null,
}: {
  compra: CompraBarraFija
  op: OpcionesBarraEscritorio
  /** `sticky.label` (vale para las dos barras). */
  texto: string | null
  /** `sticky.addFx` (vale para las dos barras). */
  alAgregar: EfectoAgregarBarraFija
  productId: number
  productName: string
  price: number
  primaryColor: string
  conFavorito: boolean
  precioEnBoton: boolean
  organization: OrganizationWithDetails | null
  /** Cantidad en un escalón de precio por volumen: «Agregar 6 al carrito · $ 57.000». */
  botonVolumen?: BotonVolumen | null
}) {
  const { formatPrice } = useCurrency()
  const { visible: debeVerse, bajando } = useVisibilidadBarra(op.aparece)
  const reemplaza = op.posicion === 'replace'
  const visible = reemplaza ? barraReemplazaVisible(debeVerse, bajando) : debeVerse
  const borde = useBordeCabecera(op.posicion === 'top')
  const barraRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  useEmpujeChat(useId(), barraRef, visible, op.posicion === 'bottom')
  useCabeceraEscondida(reemplaza, visible)
  // Escondida: fuera del orden de tabulación (React 18 no tipa `inert`).
  useEffect(() => {
    barraRef.current?.toggleAttribute('inert', !visible)
  }, [visible])

  const { added, aviso, outOfStock, sinCupo, attributeGroups, selectedAttributes, hasVariants, activePrice, handleAttributeSelect } = compra
  const bloqueado = outOfStock || sinCupo
  const textoAgregar = textoBotonBarra(texto)
  const conInfo = op.miniatura || op.precio

  const handleAddToCart = () => {
    const desde = botonRef.current?.getBoundingClientRect() ?? null
    if (!compra.agregar()) return
    if (alAgregar === 'fly' && desde) volarAlCarrito(desde, compra.imagenActiva, primaryColor)
  }

  const estiloPosicion: CSSProperties | undefined = op.posicion === 'top' ? { top: borde } : op.posicion === 'replace' ? { top: 0 } : undefined

  return (
    <div
      ref={barraRef}
      className={clasesContenedor(op.posicion, op.estilo, visible)}
      style={estiloPosicion}
      data-barra-fija-escritorio={op.posicion}
      aria-hidden={visible ? undefined : true}
    >
      <div className="container mx-auto flex items-center gap-3 px-4 py-2.5">
        {reemplaza && organization && (
          <div className="flex shrink-0 items-center border-r border-gray-200 pr-4">
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={28} />
          </div>
        )}

        {conInfo ? (
          <InfoProductoBarra compra={compra} nombre={productName} conImagen={op.miniatura} conNombre={op.miniatura} conPrecio={op.precio} />
        ) : (
          <div className="flex-1" />
        )}

        {op.variante && hasVariants &&
          Object.entries(attributeGroups).map(([nombre, valores]) => (
            <select
              key={nombre}
              aria-label={nombre}
              value={selectedAttributes[nombre] ?? ''}
              onChange={(e) => handleAttributeSelect(nombre, e.target.value)}
              className="h-10 max-w-[11rem] shrink-0 truncate rounded-[10px] border border-gray-300 bg-white px-3 text-sm text-gray-800"
            >
              {valores.map((v) => (
                <option key={v} value={v}>{`${nombre}: ${v}`}</option>
              ))}
            </select>
          ))}

        {op.cantidad && <CantidadCompacta compra={compra} alto="h-10" />}

        <Button
          ref={botonRef}
          onClick={handleAddToCart}
          disabled={bloqueado}
          className={`h-10 shrink-0 rounded-[10px] px-5 text-sm font-semibold transition-all ${added ? 'bg-green-500 hover:bg-green-600' : ''} ${bloqueado ? 'opacity-50' : ''}`}
          style={!added && !bloqueado ? { backgroundColor: primaryColor } : {}}
        >
          {added ? (
            <><Check className="mr-2 h-4 w-4" /> Agregado</>
          ) : outOfStock ? (
            <><ShoppingCart className="mr-2 h-4 w-4" /> Sin stock</>
          ) : (
            <>
              <ShoppingCart className="mr-2 h-4 w-4 shrink-0" />
              {botonVolumen
                ? textoBotonConPrecio(textoAgregarConCantidad(textoAgregar, botonVolumen.cantidad), formatPrice(botonVolumen.total))
                : precioEnBoton ? textoBotonConPrecio(textoAgregar, formatPrice(activePrice)) : textoAgregar}
            </>
          )}
        </Button>

        {op.comprarAhora && !outOfStock && (
          <Button
            onClick={compra.comprarAhora}
            disabled={sinCupo || compra.comprando}
            variant="outline"
            className="h-10 shrink-0 rounded-[10px] border-2 bg-white px-5 text-sm font-semibold hover:bg-gray-50"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            Comprar ahora
          </Button>
        )}

        {op.favorito && conFavorito && <BotonGuardarFicha productId={productId} precio={price} />}
      </div>
      {(aviso || sinCupo) && (
        <p role="status" className="pb-2 text-center text-sm text-amber-700">{aviso || AVISO_TOPE_CARRITO}</p>
      )}
    </div>
  )
}
