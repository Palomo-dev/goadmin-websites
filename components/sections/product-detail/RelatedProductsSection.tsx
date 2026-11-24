'use client'

import { RelatedProducts } from '@/components/site/RelatedProducts'
import { CLAVE_LAYOUT_RELACIONADOS } from '@/lib/defaultProductDetailSections'
import { isOutOfStock } from '@/lib/stock'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import {
  CLAVES_NUEVAS_RELACIONADOS,
  leerOpcionesRelacionados,
  productosCompradosJuntos,
  productosRelacionados,
} from '@/lib/website/v2/seccionesFicha'
import { CompradosJuntos, ListaCompactaRelacionados } from './RelacionadosExtra'

export const CONTENT_KEYS = ['source', 'max_items', 'title'] as const

/** Elegidos a mano y comprados juntos (los consulta la página solo si la sección los pide). */
export interface RelacionadosFichaDatos {
  manuales?: any[] | null
  juntosManuales?: any[] | null
  juntosCalculados?: any[] | null
}

interface RelatedProductsSectionProps {
  content: Record<string, any>
  primaryColor?: string
  data?: {
    relatedProducts?: any[]
    product?: any
    organizationSubdomain?: string
    branchId?: number | null
    price?: number
    relacionadosFicha?: RelacionadosFichaDatos | null
    categoriaFicha?: { name?: string | null; slug?: string | null } | null
    prefijoSede?: string
  }
}

export function RelatedProductsSection({ content, primaryColor = '#3B82F6', data }: RelatedProductsSectionProps) {
  const siempre = data?.relatedProducts || []
  const product = data?.product
  const opciones = leerOpcionesRelacionados(content)
  const extras = data?.relacionadosFicha ?? null

  // Fuente: «Misma categoría» (o sin fuente) = la lista de siempre, tal cual. Las demás mezclan
  // los elegidos a mano y los comprados juntos (Figma 2989:74523).
  const listaFuente = opciones.fuente === 'category' && !extras
    ? siempre
    : productosRelacionados(opciones.fuente, { siempre: ordenarPorEtiqueta(siempre, opciones.fuente, product), ...extras }, product?.id ?? null, Math.max(siempre.length, opciones.cantidad))
  const products = opciones.ocultarAgotados ? listaFuente.filter((p) => !isOutOfStock(p)) : listaFuente

  // «Comprados juntos» (estilo): el producto de la ficha + hasta 3.
  if (opciones.conOpciones && opciones.estilo === 'juntos' && product) {
    const juntos = productosCompradosJuntos({ siempre: [], ...extras }, product.id)
    const otros = (opciones.ocultarAgotados ? juntos.filter((p) => !isOutOfStock(p)) : juntos)
    const respaldo = otros.length > 0 ? otros : products.slice(0, 3)
    return (
      <CompradosJuntos
        producto={product}
        precioProducto={typeof data?.price === 'number' && data.price > 0 ? data.price : null}
        otros={respaldo}
        cajaTotal={opciones.cajaTotal}
        titulo={content.title || 'Comprados juntos'}
        alineacionTitulo={opciones.alineacionTitulo}
        primaryColor={primaryColor}
        organizationSubdomain={data?.organizationSubdomain}
        branchId={data?.branchId ?? null}
      />
    )
  }

  if (products.length === 0) return null

  if (opciones.conOpciones && opciones.estilo === 'lista') {
    return (
      <ListaCompactaRelacionados
        productos={products.filter((p) => p.id !== product?.id).slice(0, opciones.cantidad)}
        titulo={opciones.titulo}
        alineacionTitulo={opciones.alineacionTitulo}
        primaryColor={primaryColor}
        organizationSubdomain={data?.organizationSubdomain}
        branchId={data?.branchId ?? null}
      />
    )
  }

  // `related_products_layout` es de la ficha (carrusel o grilla), no del estilo de tarjeta: no
  // viaja en `cardStyle` ni en `layoutConfig`. Sin más claves, ninguno de los dos (como el layout
  // monolítico, que no los pasaba). Las claves nuevas de la ficha tampoco viajan ahí.
  const { [CLAVE_LAYOUT_RELACIONADOS]: layout, ...conNuevas } = content
  const resto = Object.fromEntries(Object.entries(conNuevas).filter(([k]) => !CLAVES_NUEVAS_RELACIONADOS.includes(k)))
  const conResto = Object.keys(resto).length > 0
  const layoutFinal = opciones.conOpciones
    ? (opciones.estilo === 'rejilla' ? 'grid' : 'carousel')
    : (layout === 'grid' || layout === 'carousel' ? layout : undefined)
  const categoria = data?.categoriaFicha
  const verTodosHref = opciones.verTodos
    ? conPrefijo(categoria?.slug ? `/categorias/${categoria.slug}` : '/productos', data?.prefijoSede ?? '')
    : null

  return (
    <RelatedProducts
      products={products}
      primaryColor={primaryColor}
      currentProductId={product?.id}
      organizationSubdomain={data?.organizationSubdomain || ''}
      title={content.title || 'Productos relacionados'}
      maxItems={content.max_items || 8}
      cardStyle={conResto ? resto : undefined}
      layoutConfig={conResto ? resto : undefined}
      layout={layoutFinal}
      branchId={data?.branchId ?? null}
      opcionesFicha={opciones.conOpciones ? {
        columnas: opciones.columnas,
        celular: opciones.celular,
        flechas: opciones.flechas,
        puntos: opciones.puntos,
        verTodosHref,
        alineacionTitulo: opciones.alineacionTitulo,
        formaFlechas: opciones.formaFlechas,
      } : null}
    />
  )
}

/** «Misma etiqueta»: los de la etiqueta del producto primero (la lista de siempre trae `tag_id`). */
function ordenarPorEtiqueta(lista: any[], fuente: string, product: any): any[] {
  if (fuente !== 'tag' || !product?.tag_id) return lista
  const etiqueta = Number(product.tag_id)
  return [...lista].sort((a, b) => Number(Number(b.tag_id) === etiqueta) - Number(Number(a.tag_id) === etiqueta))
}
