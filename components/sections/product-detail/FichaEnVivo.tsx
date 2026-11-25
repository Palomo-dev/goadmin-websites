'use client'

/**
 * Ficha de producto en el lienzo del editor del ERP (`?preview=1`): la MISMA ficha
 * (`ProductDetailRenderer`) envuelta en `PreviewBridge`, como las demás páginas
 * (`PreviewableSections`). Los cambios de las secciones de la plantilla (acciones, beneficios,
 * descripción, galería, información, relacionados, reseñas…) llegan por `goadmin:preview` y se
 * pintan sin recargar el iframe.
 *
 * Antes la ficha se pintaba solo en el servidor y sin puente: el editor recargaba el lienzo
 * entero tras cada guardado (lento y perdía el scroll).
 *
 * Los datos (producto, variantes, relacionados, extras de los bloques nuevos) llegan ya
 * resueltos del servidor; solo cambian las secciones. La barra fija de compra también se arma
 * aquí con las opciones EN VIVO de «Botones de compra» (`barraDeFicha`).
 *
 * Fuera del lienzo no se usa: la ficha pública sigue siendo de servidor, sin JavaScript extra.
 */
import type { ComponentProps } from 'react'
import { PreviewBridge } from '@/components/sections/PreviewBridge'
import { ProductDetailRenderer } from '@/components/sections/product-detail/ProductDetailRenderer'
import { StickyAddToCart } from '@/components/site/StickyAddToCart'
import type { WebsitePageSection, WebsitePageWithSections } from '@/types/database'
import { barraDeFicha } from './barraFicha'

type PropsFicha = ComponentProps<typeof ProductDetailRenderer>
type PropsBarra = ComponentProps<typeof StickyAddToCart>

interface FichaEnVivoProps {
  ficha: PropsFicha
  /**
   * Barra fija sin las opciones de la plantilla (las pone `barraDeFicha` con las secciones en
   * vivo). `null` si la ficha no admite barra (sin precio, grupo obligatorio, padre sin variantes).
   * `organization` es la del logo «en lugar de la cabecera».
   */
  barra: Omit<PropsBarra, 'precioEnBoton' | 'celular' | 'escritorio' | 'organization' | 'clienteElige' | 'textoElegir'> | null
}

/** La plantilla con las secciones en vivo (sin plantilla, una mínima: el renderer solo lee esto). */
function plantillaConSecciones(base: WebsitePageWithSections | null, secciones: WebsitePageSection[]): WebsitePageWithSections | null {
  if (base) return { ...base, website_page_sections: secciones }
  if (secciones.length === 0) return null
  return { page_settings: null, website_page_sections: secciones } as unknown as WebsitePageWithSections
}

export function FichaEnVivo({ ficha, barra }: FichaEnVivoProps) {
  const iniciales = ficha.templatePage?.website_page_sections ?? []
  return (
    <PreviewBridge initialSections={iniciales}>
      {(vivas) => {
        const opciones = barraDeFicha(vivas)
        const conBarra = barra && (opciones.barraFija || opciones.barraEscritorio)
        return (
          <>
            {/* Etiquetas de la ficha: en el lienzo, las que el producto no cumple salen de muestra. */}
            <ProductDetailRenderer {...ficha} templatePage={plantillaConSecciones(ficha.templatePage, vivas)} muestrasEtiquetas />
            {conBarra && (
              <StickyAddToCart
                {...barra}
                precioEnBoton={opciones.precioEnBarra}
                clienteElige={opciones.selector.inicial === 'customer'}
                textoElegir={opciones.selector.textoElegir}
                celular={opciones.opciones.celular}
                escritorio={opciones.opciones.escritorio}
                organization={opciones.barraEscritorio && opciones.opciones.escritorio.posicion === 'replace' ? ficha.organization : null}
              />
            )}
          </>
        )
      }}
    </PreviewBridge>
  )
}
