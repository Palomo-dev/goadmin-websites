'use client'

/**
 * Promociones con etiqueta en el navegador («2 X 1», «−20 %», «Combo»), como el precio por volumen
 * (`volumen/EscalonesTiendaContext.tsx`):
 *  - `ProveedorPromosEtiqueta` (en OrganizationLayout): las promociones públicas vigentes de la
 *    organización, cargadas UNA vez en el servidor (`getEtiquetasPromoTienda`). Las tarjetas y la
 *    ficha las resuelven en memoria por producto: ninguna consulta por producto.
 *  - Grupo de clientes: si la organización tiene promociones «solo para el grupo …» y el navegador
 *    tiene sesión (se lee del navegador, sin consulta), se piden UNA vez a /api/promotions/etiquetas,
 *    que verifica el grupo en el servidor. Sin sesión, no se prometen.
 * Sin proveedor (otra página, vista de referencia) los hooks devuelven null y nada cambia.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProductoEscalones } from '@/lib/promociones/escalonesTienda'
import { ordenarPromos, promoParaProducto, type PromoEtiquetaTienda } from '@/lib/promociones/etiquetasPromocion'

interface PromosEtiqueta {
  promos: readonly PromoEtiquetaTienda[]
  zona: string
}

const PromosEtiquetaContext = createContext<PromosEtiqueta | null>(null)

export function ProveedorPromosEtiqueta({ promos, hayDeCliente, sede, zona, children }: {
  promos: readonly PromoEtiquetaTienda[]
  hayDeCliente: boolean
  /** Sede de la página (outlet), para validar en el servidor las promociones por sede. */
  sede?: number | null
  zona?: string | null
  children: ReactNode
}) {
  const [deCliente, setDeCliente] = useState<PromoEtiquetaTienda[]>([])
  useEffect(() => {
    if (!hayDeCliente) return
    let vigente = true
    createClient().auth.getSession()
      .then(async ({ data }) => {
        if (!vigente || !data.session?.user) return
        const url = sede != null ? `/api/promotions/etiquetas?sede=${encodeURIComponent(String(sede))}` : '/api/promotions/etiquetas'
        const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
        if (!r.ok) return
        const j = (await r.json()) as { promos?: PromoEtiquetaTienda[] }
        if (vigente && Array.isArray(j.promos) && j.promos.length > 0) setDeCliente(j.promos)
      })
      .catch(() => { /* sin sesión o sin red: solo las públicas */ })
    return () => { vigente = false }
  }, [hayDeCliente, sede])

  const valor = useMemo(() => ({
    promos: deCliente.length > 0 ? ordenarPromos([...deCliente, ...promos]) : promos,
    zona: zona || 'America/Bogota',
  }), [promos, deCliente, zona])
  if (promos.length === 0 && !hayDeCliente) return <>{children}</>
  return <PromosEtiquetaContext.Provider value={valor}>{children}</PromosEtiquetaContext.Provider>
}

/** Zona horaria de la organización (o la de Colombia sin proveedor). */
export function useZonaPromos(): string {
  return useContext(PromosEtiquetaContext)?.zona ?? 'America/Bogota'
}

/** Promoción con etiqueta de un producto (o null). Datos que falten = desconocidos. */
export function usePromoProducto(producto: Partial<ProductoEscalones> | null | undefined): PromoEtiquetaTienda | null {
  const promos = useContext(PromosEtiquetaContext)?.promos ?? null
  const id = producto?.id
  const padre = producto?.parent_product_id
  const categoria = producto?.category_id
  const marca = producto?.brand
  return useMemo(() => {
    if (!promos || promos.length === 0 || id == null || !Number.isFinite(Number(id))) return null
    return promoParaProducto(promos, { id: Number(id), parent_product_id: padre, category_id: categoria, brand: marca })
  }, [promos, id, padre, categoria, marca])
}

/** Datos de producto de un listado: lo que no trae queda desconocido (`undefined`). */
export function productoDeListado(product: Record<string, unknown> | null | undefined): Partial<ProductoEscalones> | null {
  if (!product || product.id == null || !Number.isFinite(Number(product.id))) return null
  const tiene = (k: string) => Object.prototype.hasOwnProperty.call(product, k)
  return {
    id: Number(product.id),
    parent_product_id: tiene('parent_product_id') ? (product.parent_product_id as number | null) ?? null : undefined,
    category_id: tiene('category_id') ? (product.category_id as number | null) ?? null : undefined,
    brand: tiene('brand') ? (product.brand as string | null) ?? null : undefined,
  }
}
