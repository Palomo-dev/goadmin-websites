'use client'

/**
 * Precio por volumen en el navegador (Figma «16 Sitio web» 3006:75498).
 *
 * Dos contextos:
 *  - `ProveedorEscalonesTienda` (en OrganizationLayout): las promociones por volumen vigentes de la
 *    organización, cargadas UNA vez en el servidor (`getEscalonesTienda`). Las tarjetas de los
 *    listados las resuelven en memoria por producto: ninguna consulta por producto.
 *  - `ProveedorFichaVolumen` (en la ficha): qué producto se está viendo (id, padre, categoría,
 *    marca y sus variantes), para que el precio, la galería y el selector de cantidad pinten su
 *    escalón sin recibir props nuevas.
 * Sin proveedor (otra página, vista de referencia) los hooks devuelven null y nada cambia.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { escalonesParaProducto, type ProductoEscalones, type PromoEscalonesTienda, type VolumenProducto } from '@/lib/promociones/escalonesTienda'

interface EscalonesTienda {
  promos: readonly PromoEscalonesTienda[]
  /** Zona horaria de la organización (fecha «Oferta válida hasta …»). */
  zona: string
}

const EscalonesTiendaContext = createContext<EscalonesTienda | null>(null)

export function ProveedorEscalonesTienda({ promos, zona, children }: { promos: readonly PromoEscalonesTienda[]; zona?: string | null; children: ReactNode }) {
  const valor = useMemo(() => ({ promos, zona: zona || 'America/Bogota' }), [promos, zona])
  if (promos.length === 0) return <>{children}</>
  return <EscalonesTiendaContext.Provider value={valor}>{children}</EscalonesTiendaContext.Provider>
}

/** Zona horaria de la organización (o la de Colombia sin proveedor). */
export function useZonaEscalones(): string {
  return useContext(EscalonesTiendaContext)?.zona ?? 'America/Bogota'
}

/** Precio por volumen de un producto de un listado (o null). Datos que falten = desconocidos. */
export function useVolumenProducto(producto: Partial<ProductoEscalones> | null | undefined): VolumenProducto | null {
  const promos = useContext(EscalonesTiendaContext)?.promos ?? null
  const id = producto?.id
  const padre = producto?.parent_product_id
  const categoria = producto?.category_id
  const marca = producto?.brand
  return useMemo(() => {
    if (!promos || id == null) return null
    return escalonesParaProducto(promos, { id: Number(id), parent_product_id: padre, category_id: categoria, brand: marca })
  }, [promos, id, padre, categoria, marca])
}

// ── Ficha ────────────────────────────────────────────────────────────────────────────────────────

interface FichaVolumen {
  producto: ProductoEscalones
  /** Ids de las variantes del padre (sin ellas, producto simple). */
  variantes: number[]
}

const FichaVolumenContext = createContext<FichaVolumen | null>(null)

export function ProveedorFichaVolumen({ producto, variantes = [], children }: { producto: ProductoEscalones; variantes?: number[]; children: ReactNode }) {
  const valor = useMemo(() => ({ producto, variantes }), [producto, variantes])
  return <FichaVolumenContext.Provider value={valor}>{children}</FichaVolumenContext.Provider>
}

/** Producto de la ficha (o null fuera de la ficha). */
export function useFichaVolumen(): FichaVolumen | null {
  return useContext(FichaVolumenContext)
}

/**
 * Precio por volumen de lo que se ve en la ficha: la variante elegida si la hay (una regla puede
 * nombrar una variante concreta) y, si no, el producto.
 */
export function useVolumenFicha(varianteId?: number | null): VolumenProducto | null {
  const resolver = useResolverVolumenFicha()
  return useMemo(() => resolver(varianteId), [resolver, varianteId])
}

/**
 * Lo mismo que `useVolumenFicha`, pero como función: para quien conoce la variante solo al pintar
 * (las filas de botones que arma VariantSelector). Fuera de la ficha, siempre null.
 */
export function useResolverVolumenFicha(): (varianteId?: number | null) => VolumenProducto | null {
  const ficha = useContext(FichaVolumenContext)
  const promos = useContext(EscalonesTiendaContext)?.promos ?? null
  return useCallback(
    (varianteId?: number | null) => {
      if (!ficha || !promos) return null
      const p = ficha.producto
      if (varianteId != null && ficha.variantes.includes(Number(varianteId))) {
        // Variante: hija del producto de la ficha, con su categoría y su marca.
        return escalonesParaProducto(promos, { id: Number(varianteId), parent_product_id: p.id, category_id: p.category_id, brand: p.brand })
      }
      return escalonesParaProducto(promos, p)
    },
    [ficha, promos],
  )
}
