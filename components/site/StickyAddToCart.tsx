'use client'

import { useState, useRef, useId, type CSSProperties } from 'react'
import { ShoppingCart, Check, X, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AVISO_TOPE_CARRITO } from '@/lib/stock'
import { useCurrency } from '@/components/site/CurrencyProvider'
import type { OrdenAtributos } from '@/lib/products/ordenAtributos'
import { BotonGuardarFicha } from '@/components/site/favoritos/BotonGuardarFicha'
import { textoBotonConPrecio } from '@/lib/website/v2/contrato/seccionesTienda'
import {
  CELULAR_POR_DEFECTO,
  TEXTO_CORTO_BARRA_FIJA,
  textoBotonBarra,
  type EstiloBarraFija,
  type OpcionesBarraCelular,
  type OpcionesBarraEscritorio,
} from '@/lib/website/v2/barraFija'
import { useCompraBarraFija, type CompraBarraFija, type VariantData } from '@/components/site/barraFija/useCompraBarraFija'
import { CantidadCompacta, InfoProductoBarra } from '@/components/site/barraFija/PartesBarraFija'
import { useEmpujeChat, useVisibilidadBarra, vibrarSuave, volarAlCarrito } from '@/components/site/barraFija/efectosBarraFija'
import { BarraFijaEscritorio } from '@/components/site/barraFija/BarraFijaEscritorio'
import { useAvisoBarraFijaCelular } from '@/components/site/menuInferior/estadoMenuInferior'
import { useVolumenFicha } from '@/components/site/volumen/EscalonesTiendaContext'
import { botonConVolumen, textoAgregarConCantidad, type BotonVolumen } from '@/lib/promociones/escalonesTienda'
import type { OrganizationWithDetails } from '@/types/database'

interface StickyAddToCartProps {
  productId: number
  productName: string
  price: number
  comparePrice?: number | null
  imageUrl?: string | null
  primaryColor: string
  isParent?: boolean
  variants?: VariantData[]
  organizationSubdomain?: string
  trackStock?: boolean
  stockLevels?: { qty_on_hand: number; qty_reserved: number }[]
  branchId?: number | null
  /** `display_order` del catálogo. Sin él, XS…XXXL y números de menor a mayor. */
  ordenAtributos?: OrdenAtributos | null
  /**
   * Corazón pequeño al lado de «Agregar» (Figma 2781:65848). `false` en el restaurante; también
   * se oculta solo con «Corazón en la ficha» apagado (BotonGuardarFicha).
   */
  conFavorito?: boolean
  /** «Agregar al carrito · $ X» (`product_actions.show_price_in_button`). */
  precioEnBoton?: boolean
  /**
   * Barra del celular (`product_actions.sticky` + `sticky_mobile`, lib/website/v2/barraFija.ts).
   * Sin ella, la de hoy. Apagada (`encendida: false`), no se pinta.
   */
  celular?: OpcionesBarraCelular | null
  /** Barra del computador (`sticky.desktop`). Sin ella o apagada, no hay barra desde 1024 px (hoy). */
  escritorio?: OpcionesBarraEscritorio | null
  /** Logo de «en lugar de la cabecera» (el mismo componente de la cabecera). */
  organization?: OrganizationWithDetails | null
  /** «Que el cliente elija» (`product_actions.initial_variant`): la barra no elige talla sola. */
  clienteElige?: boolean
  /** «Elige tu {opción}» del editor (`choose_text`). */
  textoElegir?: string
}

/** Contenedor de la barra del celular según el estilo (Figma 2857:71321). `flat` = el de hoy. */
function clasesContenedorCelular(estilo: EstiloBarraFija, visible: boolean): string {
  if (estilo === 'floating') {
    return `fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)] transition-transform duration-300 lg:hidden ${
      visible ? 'translate-y-0' : 'translate-y-[calc(100%+2rem)]'
    }`
  }
  if (estilo === 'glass') {
    return `fixed bottom-0 left-0 right-0 z-50 border-t border-white/60 bg-white/70 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-transform duration-300 lg:hidden ${
      visible ? 'translate-y-0' : 'translate-y-full'
    }`
  }
  return `fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 lg:hidden ${
    visible ? 'translate-y-0' : 'translate-y-full'
  }`
}

export function StickyAddToCart({
  productId,
  productName,
  price,
  comparePrice,
  imageUrl,
  primaryColor,
  isParent = false,
  variants = [],
  organizationSubdomain,
  trackStock,
  stockLevels,
  branchId,
  ordenAtributos = null,
  conFavorito = false,
  precioEnBoton = false,
  celular = null,
  escritorio = null,
  organization = null,
  clienteElige = false,
  textoElegir,
}: StickyAddToCartProps) {
  // Una sola lógica de compra para las dos barras (variantes, stock, tope, agregar).
  const compra = useCompraBarraFija({
    productId,
    productName,
    price,
    comparePrice,
    imageUrl,
    isParent,
    variants,
    organizationSubdomain,
    trackStock,
    stockLevels,
    branchId,
    ordenAtributos,
    clienteElige,
    textoElegir,
  })
  const op = celular ?? CELULAR_POR_DEFECTO
  // «Compra más, paga menos» (Figma «16 Sitio web» S2): la cantidad elegida en un escalón pone su
  // total en el botón. Fuera de la ficha (sin proveedor) o fuera de escalón, null: la barra de hoy.
  const volumen = useVolumenFicha(compra.hasVariants ? compra.selectedVariant?.id ?? null : null)
  const botonVolumen = botonConVolumen(volumen, compra.activePrice, compra.cantidad)
  return (
    <>
      {op.encendida && (
        <BarraCelular
          compra={compra}
          op={op}
          productId={productId}
          productName={productName}
          price={price}
          primaryColor={primaryColor}
          conFavorito={conFavorito}
          precioEnBoton={precioEnBoton}
          botonVolumen={botonVolumen}
        />
      )}
      {escritorio?.encendida && (
        <BarraFijaEscritorio
          compra={compra}
          op={escritorio}
          texto={op.texto}
          alAgregar={op.alAgregar}
          productId={productId}
          productName={productName}
          price={price}
          primaryColor={primaryColor}
          conFavorito={conFavorito}
          precioEnBoton={precioEnBoton}
          organization={organization}
          botonVolumen={botonVolumen}
        />
      )}
    </>
  )
}

/**
 * Barra del celular (hasta 1023 px). Sin opciones, la de hoy (Figma 2856:71203, B0a–B0d): plana,
 * «Agregar al carrito» ancho + corazón, línea de la variante y ^ para la hoja de opciones.
 * Opciones (2857:71321): estilo flotante o vidrio (B2, B3), miniatura y precio (B1), cantidad y
 * «Comprar ahora» (B2), texto propio (B3), vuela al carrito y vibración (B4), chat encima (B5).
 */
function BarraCelular({
  compra,
  op,
  productId,
  productName,
  price,
  primaryColor,
  conFavorito,
  precioEnBoton,
  botonVolumen = null,
}: {
  compra: CompraBarraFija
  op: OpcionesBarraCelular
  productId: number
  productName: string
  price: number
  primaryColor: string
  conFavorito: boolean
  precioEnBoton: boolean
  /** Cantidad en un escalón de precio por volumen (S2): «6 × $ 9.500 · Agregar · $ 57.000». */
  botonVolumen?: BotonVolumen | null
}) {
  const [expanded, setExpanded] = useState(false)
  const { visible } = useVisibilidadBarra(op.aparece)
  const barraRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  // El menú de abajo se oculta o se apila mientras la barra se ve (Figma 2844:70510 F1/F2). Va
  // antes del empuje del chat: apilada, la barra sube y su alto medido ya lo incluye.
  useAvisoBarraFijaCelular(visible)
  useEmpujeChat(useId(), barraRef, visible, true)
  const { formatPrice } = useCurrency()
  const {
    added,
    aviso,
    outOfStock,
    sinCupo,
    attributeGroups,
    selectedAttributes,
    selectedVariant,
    hasVariants,
    activePrice,
    handleAttributeSelect,
  } = compra

  const handleAddToCart = () => {
    const desde = botonRef.current?.getBoundingClientRect() ?? null
    if (!compra.agregar()) return
    setExpanded(false)
    if (op.vibracion) vibrarSuave()
    if (op.alAgregar === 'fly' && desde) volarAlCarrito(desde, compra.imagenActiva, primaryColor)
  }

  // B1: miniatura en la misma fila que el botón · B2: miniatura arriba (con cantidad o «Comprar ahora»).
  const filaInfoArriba = op.miniatura && (op.cantidad || op.comprarAhora)
  const infoEnLinea = op.miniatura && !filaInfoArriba
  const conCorazon = conFavorito && op.favorito
  // El botón comparte la fila con la miniatura o con «Comprar ahora»: texto corto.
  const corto = infoEnLinea || op.comprarAhora
  const textoAgregar = op.texto ?? (corto ? TEXTO_CORTO_BARRA_FIJA : textoBotonBarra(null))
  // S2: en la barra de siempre (sin miniatura, cantidad ni «Comprar ahora», sin variantes) va
  // «6 × $ 9.500 / Ahorras $ 9.000» a la izquierda y el botón corto «Agregar · $ 57.000». Con más
  // piezas en la fila, el botón lleva la cantidad: «Agregar 6 al carrito · $ 57.000».
  const infoVolumen = !!botonVolumen && !hasVariants && !op.miniatura && !op.cantidad && !op.comprarAhora
  const textoConPrecio = botonVolumen
    ? infoVolumen
      ? textoBotonConPrecio(op.texto ?? TEXTO_CORTO_BARRA_FIJA, formatPrice(botonVolumen.total))
      : textoBotonConPrecio(textoAgregarConCantidad(textoAgregar, botonVolumen.cantidad), formatPrice(botonVolumen.total))
    : precioEnBoton ? textoBotonConPrecio(textoAgregar, formatPrice(activePrice)) : textoAgregar
  const agregarConBorde = op.comprarAhora
  const bloqueado = outOfStock || sinCupo
  const estiloAgregar: CSSProperties = added || bloqueado
    ? {}
    : agregarConBorde
      ? { borderColor: primaryColor, color: primaryColor }
      : { backgroundColor: primaryColor }

  return (
    <>
      {/* Overlay cuando está expandido */}
      {expanded && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setExpanded(false)} />
      )}

      <div ref={barraRef} className={clasesContenedorCelular(op.estilo, visible)} data-barra-fija={op.estilo === 'flat' ? undefined : op.estilo} data-barra-fija-celular="">
        {/* Panel expandido de variantes */}
        {expanded && hasVariants && (
          <div className="px-4 pt-4 pb-2 border-b max-h-[50vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-gray-700">Selecciona opciones</p>
              <button onClick={() => setExpanded(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            {Object.entries(attributeGroups).map(([attrName, values]) => (
              <div key={attrName} className="mb-3">
                <label className="text-xs font-medium text-gray-600 capitalize mb-1 block">{attrName}:</label>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => {
                    const isSelected = selectedAttributes[attrName] === value
                    return (
                      <button
                        key={value}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'text-white border-transparent'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                        style={isSelected ? { backgroundColor: primaryColor } : {}}
                        onClick={() => handleAttributeSelect(attrName, value)}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {(aviso || sinCupo) && (
          <p role="status" className="px-4 pt-2 text-center text-sm text-amber-700">{aviso || AVISO_TOPE_CARRITO}</p>
        )}

        {/* Barra principal (Figma 2781:65848): siempre «Agregar al carrito» relleno + corazón
            pequeño, sea cual sea la distribución de la ficha. */}
        <div className="container mx-auto px-4 py-3">
          {filaInfoArriba && (
            <div className="mb-3 flex items-center gap-3">
              <InfoProductoBarra compra={compra} nombre={productName} />
              {conCorazon && <BotonGuardarFicha productId={productId} precio={price} />}
            </div>
          )}
          {hasVariants && selectedVariant?.variant_data && (
            <p className="mb-2 truncate text-xs text-gray-500">
              {Object.entries(selectedVariant.variant_data).map(([k, v]) => `${k}: ${v}`).join(' • ')}
            </p>
          )}
          <div className="flex items-center gap-3">
            {hasVariants && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label="Elegir opciones"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-gray-300 hover:bg-gray-50"
              >
                <ChevronUp className="h-4 w-4 text-gray-600" />
              </button>
            )}

            {infoEnLinea && <InfoProductoBarra compra={compra} nombre={productName} />}

            {infoVolumen && botonVolumen && (
              <div className="min-w-0 flex-1" data-volumen-barra="">
                <p className="truncate text-[15px] font-semibold text-gray-900">
                  {botonVolumen.cantidad} × {formatPrice(botonVolumen.unitario)}
                </p>
                {botonVolumen.ahorro > 0 && (
                  <p className="truncate text-xs font-medium text-green-700">Ahorras {formatPrice(botonVolumen.ahorro)}</p>
                )}
              </div>
            )}

            {op.cantidad && <CantidadCompacta compra={compra} />}

            <Button
              ref={botonRef}
              onClick={handleAddToCart}
              className={`h-12 min-w-0 ${infoEnLinea || infoVolumen ? 'shrink-0' : 'flex-1'} rounded-[10px] px-4 text-[15px] font-semibold transition-all ${agregarConBorde && !added ? 'border-2 bg-white hover:bg-gray-50' : ''} ${added ? 'bg-green-500 hover:bg-green-600' : ''} ${outOfStock || sinCupo ? 'opacity-50' : ''}`}
              style={estiloAgregar}
              disabled={outOfStock || sinCupo}
            >
              {added ? (
                <><Check className="h-5 w-5 mr-2" /> Agregado</>
              ) : outOfStock ? (
                <><ShoppingCart className="h-5 w-5 mr-2" /> Sin stock</>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5 mr-2 shrink-0" />
                  <span className="truncate">
                    {textoConPrecio}
                  </span>
                </>
              )}
            </Button>

            {op.comprarAhora && !outOfStock && (
              <Button
                onClick={compra.comprarAhora}
                disabled={sinCupo || compra.comprando}
                className="h-12 min-w-0 flex-1 rounded-[10px] px-4 text-[15px] font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                <span className="truncate">Comprar ahora</span>
              </Button>
            )}

            {conCorazon && !filaInfoArriba && <BotonGuardarFicha productId={productId} precio={price} />}
          </div>
        </div>
      </div>
    </>
  )
}
