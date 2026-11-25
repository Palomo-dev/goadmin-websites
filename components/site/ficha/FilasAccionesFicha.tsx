'use client'

/**
 * Botones de compra de la ficha armados en filas (Figma 2779:65038, frame E): los lee del bloque
 * `product_actions` (`lib/website/v2/accionesFicha.ts`, copia del ERP) y los pinta con el
 * componente del diseño. Igual en escritorio y celular; en el celular, un botón que comparte fila
 * usa su texto corto.
 *
 * No sabe agregar ni pagar: quien lo usa (ProductDetailActions para el producto simple y
 * VariantSelector para el padre con variantes) le pasa qué hace cada botón. El favorito es el de
 * siempre (BotonGuardarFicha, con su lógica de favoritos).
 */
import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useOpcionesTienda } from '@/components/site/OpcionesTiendaContext'
import { BotonGuardarFicha } from '@/components/site/favoritos/BotonGuardarFicha'
import { BotonAccionFicha, type EstadoBotonAccion } from './BotonAccionFicha'
import {
  accionesVisibles,
  armarFilas,
  cantidadConEtiqueta,
  enlaceWhatsappFicha,
  mensajeWhatsappFicha,
  numeroWhatsappFicha,
  textoCortoDeAccion,
  textoDeAccion,
  usaTextoCorto,
  type AccionFicha,
} from '@/lib/website/v2/accionesFicha'
import { textoBotonConPrecio } from '@/lib/website/v2/contrato/seccionesTienda'
import { textoAgregarConCantidad } from '@/lib/promociones/escalonesTienda'

export interface CantidadFicha {
  valor: number
  onMenos: () => void
  onMas: () => void
  masDeshabilitado: boolean
  deshabilitado?: boolean
  /** Rótulo junto al selector («Botones de compra › Textos de la compra»). Ausente = «Cantidad». */
  texto?: string
}

export interface AgregarFicha {
  onClick: () => void
  deshabilitado: boolean
  /** Reemplaza el texto del botón: «Sin stock», «Elige tu talla», «¡Agregado al carrito!»… */
  reemplazo?: { texto: string; estado?: EstadoBotonAccion } | null
  /** Precio ya formateado si va dentro del botón (`show_price_in_button`). */
  precio?: string | null
  /**
   * Precio por volumen (Figma «16 Sitio web» S1): la cantidad va en el texto, «Agregar 6 al
   * carrito», y `precio` trae el total con el escalón. Ausente = el texto de siempre.
   */
  cantidadEnTexto?: number | null
}

export interface ComprarFicha {
  onClick: () => void
  deshabilitado: boolean
  pendiente: boolean
  /** «Sin stock» / «Agotado» cuando no hay unidades. */
  agotado?: string | null
}

export interface FilasAccionesFichaProps {
  acciones: readonly AccionFicha[]
  primaryColor: string
  cantidad: CantidadFicha
  agregar: AgregarFicha
  comprar: ComprarFicha | null
  /** `null` = sin corazón (restaurante). */
  favorito: { productId: number; precio: number | null } | null
  /** Número del sitio (Configuración › Contacto). Sin número, el botón no sale. */
  whatsapp: { numero: string | null; producto: string; variante?: string | null } | null
  /** Título que se comparte (nombre del producto). */
  compartir: { titulo: string } | null
}

/** Enlace de la ficha sin parámetros (lo que se comparte y lo que va en el mensaje). */
function enlaceFicha(): string {
  return typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`
}

/** «Tienda/Selector de cantidad» (Figma 2780:65946). */
function SelectorCantidad({ cantidad, etiqueta }: { cantidad: CantidadFicha; etiqueta: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-3" data-accion-ficha="cantidad">
      {etiqueta && <span className="text-[15px] font-medium text-gray-700">{cantidad.texto || 'Cantidad'}</span>}
      <div className={`flex h-12 items-center rounded-[10px] border border-gray-300 bg-white ${cantidad.deshabilitado ? 'pointer-events-none opacity-50' : ''}`}>
        <button
          type="button"
          onClick={cantidad.onMenos}
          disabled={cantidad.valor <= 1}
          aria-label="Quitar una unidad"
          className="flex h-full w-11 items-center justify-center rounded-l-[10px] text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus aria-hidden="true" className="h-4 w-4" />
        </button>
        <span aria-live="polite" className="min-w-[2.5rem] text-center text-[15px] font-semibold text-gray-900">{cantidad.valor}</span>
        <button
          type="button"
          onClick={cantidad.onMas}
          disabled={cantidad.masDeshabilitado}
          aria-label="Agregar una unidad"
          className="flex h-full w-11 items-center justify-center rounded-r-[10px] text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** «Compartir»: Web Share del celular; sin ella, copia el enlace y lo avisa en el botón. */
function BotonCompartir({ accion, corto, primaryColor, titulo }: { accion: AccionFicha; corto: boolean; primaryColor: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false)
  useEffect(() => {
    if (!copiado) return
    const t = window.setTimeout(() => setCopiado(false), 2000)
    return () => window.clearTimeout(t)
  }, [copiado])
  const compartir = async () => {
    const url = enlaceFicha()
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: titulo, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopiado(true)
    } catch {
      // El cliente cerró el menú de compartir o el navegador no dejó copiar: nada que hacer.
    }
  }
  return (
    <BotonAccionFicha
      tipo="compartir"
      tamano={accion.tamano}
      estilo={accion.estilo}
      estado={copiado ? 'exito' : 'normal'}
      texto={copiado ? 'Enlace copiado' : textoDeAccion(accion)}
      textoCelular={copiado ? null : corto ? textoCortoDeAccion(accion) : null}
      etiqueta={copiado ? 'Enlace copiado' : textoDeAccion(accion)}
      primaryColor={primaryColor}
      onClick={compartir}
    />
  )
}

export function FilasAccionesFicha({ acciones, primaryColor, cantidad, agregar, comprar, favorito, whatsapp, compartir }: FilasAccionesFichaProps) {
  const { favoritos } = useOpcionesTienda()
  const numero = whatsapp ? numeroWhatsappFicha(whatsapp.numero) : null
  const filas = armarFilas(
    accionesVisibles(acciones, {
      favorito: !!favorito && favoritos.corazonFicha,
      comprar: !!comprar,
      whatsapp: !!numero,
      compartir: !!compartir,
    }),
  )

  const pintar = (accion: AccionFicha, fila: AccionFicha[]) => {
    const corto = usaTextoCorto(fila, accion)
    const textoCelular = corto ? textoCortoDeAccion(accion) : null
    switch (accion.tipo) {
      case 'cantidad':
        return <SelectorCantidad key="cantidad" cantidad={cantidad} etiqueta={cantidadConEtiqueta(fila)} />
      case 'agregar': {
        const r = agregar.reemplazo
        const precio = agregar.precio ?? null
        const n = agregar.cantidadEnTexto ?? null
        const conCantidad = (t: string) => (n ? textoAgregarConCantidad(t, n) : t)
        return (
          <BotonAccionFicha
            key="agregar"
            tipo="agregar"
            tamano={accion.tamano}
            estilo={accion.estilo}
            estado={r?.estado ?? (agregar.deshabilitado ? 'deshabilitado' : 'normal')}
            texto={r ? r.texto : textoBotonConPrecio(conCantidad(textoDeAccion(accion)), precio)}
            textoCelular={r ? null : textoCelular ? textoBotonConPrecio(conCantidad(textoCelular), precio) : null}
            etiqueta={r ? r.texto : textoDeAccion(accion)}
            primaryColor={primaryColor}
            onClick={agregar.onClick}
          />
        )
      }
      case 'comprar': {
        if (!comprar) return null
        const estado: EstadoBotonAccion = comprar.pendiente ? 'cargando' : comprar.deshabilitado ? 'deshabilitado' : 'normal'
        const texto = comprar.agotado ? comprar.agotado : comprar.pendiente ? 'Abriendo el pago…' : textoDeAccion(accion)
        return (
          <BotonAccionFicha
            key="comprar"
            tipo="comprar"
            tamano={accion.tamano}
            estilo={accion.estilo}
            estado={estado}
            texto={texto}
            textoCelular={comprar.agotado || comprar.pendiente ? null : textoCelular}
            etiqueta={texto}
            primaryColor={primaryColor}
            onClick={comprar.onClick}
          />
        )
      }
      case 'favorito':
        if (!favorito) return null
        return (
          <BotonGuardarFicha
            key="favorito"
            productId={favorito.productId}
            precio={favorito.precio}
            tamano={accion.tamano}
            estilo={accion.estilo}
            texto={accion.texto}
            textoCelular={textoCelular}
            primaryColor={primaryColor}
          />
        )
      case 'whatsapp': {
        if (!whatsapp || !numero) return null
        return (
          <BotonAccionFicha
            key="whatsapp"
            tipo="whatsapp"
            tamano={accion.tamano}
            estilo={accion.estilo}
            texto={textoDeAccion(accion)}
            textoCelular={textoCelular}
            etiqueta={textoDeAccion(accion)}
            primaryColor={primaryColor}
            // El enlace se arma al tocar: lleva la variante elegida y la dirección real de la ficha.
            onClick={() => {
              const href = enlaceWhatsappFicha(numero, mensajeWhatsappFicha(whatsapp.producto, whatsapp.variante, enlaceFicha()))
              if (href) window.open(href, '_blank', 'noopener,noreferrer')
            }}
          />
        )
      }
      case 'compartir':
        if (!compartir) return null
        return <BotonCompartir key="compartir" accion={accion} corto={corto} primaryColor={primaryColor} titulo={compartir.titulo} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-3" data-acciones-ficha="">
      {filas.map((fila, i) => (
        <div key={i} className="flex items-center gap-3">
          {fila.map((accion) => pintar(accion, fila))}
        </div>
      ))}
    </div>
  )
}

