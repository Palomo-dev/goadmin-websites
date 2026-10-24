'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Loader2, X } from 'lucide-react'
import { VariantSelector } from './VariantSelector'
import type { ModifierGroup } from './ProductModifierSelector'
import type { OrdenAtributos } from '@/lib/products/ordenAtributos'
import { agregarPlatoAlCarrito } from '@/lib/cart'

type Variante = ComponentProps<typeof VariantSelector>['variants'][number]
type Producto = Variante & { is_parent?: boolean; has_variants?: boolean }
type Opciones = { variants: Variante[]; modifierGroups: ModifierGroup[]; ordenAtributos: OrdenAtributos | null }

export interface ProductChoiceDialogProps {
  product: Producto
  primaryColor: string
  organizationSubdomain?: string
  branchId?: number | null
  requiresVariants: boolean
  onClose: () => void
  onAdded?: () => void
}

/** Carga las opciones del mismo endpoint que usa el catálogo y reutiliza su validación. */
export function ProductChoiceDialog({ product, primaryColor, organizationSubdomain, branchId, requiresVariants, onClose, onAdded }: ProductChoiceDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  const [opciones, setOpciones] = useState<Opciones | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setOpciones(null)
    setError(null)
    const params = new URLSearchParams()
    if (branchId != null) params.set('branchId', String(branchId))
    const cargar = async () => {
      try {
        const response = await fetch(`/api/products/${encodeURIComponent(String(product.id))}/variants${params.size ? `?${params}` : ''}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('No se pudieron cargar las opciones.')
        const data = await response.json()
        if (!Array.isArray(data.variants) || !Array.isArray(data.modifierGroups)) throw new Error('No se pudieron cargar las opciones.')
        if (requiresVariants && data.variants.length === 0) throw new Error('Este producto no tiene variantes disponibles.')
        const propios = data.variantModifierGroups && typeof data.variantModifierGroups === 'object' ? data.variantModifierGroups : {}
        const variants = data.variants.map((v: Variante) => ({ ...v, ...(Array.isArray(propios[String(v.id)]) ? { modifier_groups: propios[String(v.id)] } : {}) }))
        if (!controller.signal.aborted) setOpciones({ variants: variants.length ? variants : [product], modifierGroups: data.modifierGroups, ordenAtributos: data.ordenAtributos ?? null })
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudieron cargar las opciones.')
      }
    }
    void cargar()
    return () => controller.abort()
  }, [product.id, branchId, requiresVariants, intento])

  useEffect(() => {
    const anterior = document.body.style.overflow
    const foco = previousFocus.current
    document.body.style.overflow = 'hidden'
    const cerrar = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', cerrar)
    return () => { document.body.style.overflow = anterior; window.removeEventListener('keydown', cerrar); foco?.focus() }
  }, [onClose])

  const selector = opciones ? <VariantSelector
    parentName={product.name}
    variants={opciones.variants}
    modifierGroups={opciones.modifierGroups}
    ordenAtributos={opciones.ordenAtributos}
    primaryColor={primaryColor}
    mode="inline"
    onClose={onClose}
    onSelect={(variant, quantity = 1, modifiers = []) => {
      const price = Number(variant.product_prices?.[0]?.price)
      if (!Number.isFinite(price) || price < 0) { setOpciones(null); setError('Este producto no tiene un precio disponible.'); return }
      const image = variant.product_images?.find((i) => i.is_primary) ?? variant.product_images?.[0]
      const path = image?.storage_path || image?.shared_images?.storage_path
      agregarPlatoAlCarrito(organizationSubdomain || window.location.hostname.split('.')[0], branchId, {
        productId: Number(variant.id), uuid: variant.uuid, name: variant.name, sku: variant.sku ?? null,
        unitPrice: price + modifiers.reduce((total, modifier) => total + (modifier.extraPrice || 0), 0),
        quantity, modifiers, variantAttributes: variant.variant_data ?? null,
        imageUrl: path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'}/storage/v1/object/public/product-images/${path}` : null,
        comparePrice: modifiers.length === 0 ? variant.product_prices?.[0]?.compare_price ?? null : null,
      })
      onAdded?.()
      onClose()
    }}
  /> : null

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Elegir ${product.name}`} className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
      if (event.key !== 'Tab') return
      const controles = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')
      if (!controles?.length) return
      const primero = controles[0], ultimo = controles[controles.length - 1]
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus() }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus() }
    }}>
      <button type="button" autoFocus onClick={onClose} aria-label="Cerrar opciones" className="float-right rounded p-2"><X aria-hidden className="h-5 w-5" /></button>
      {!opciones && <h2 className="mb-4 text-lg font-semibold">{product.name}</h2>}
      {selector || (error ? <><p role="alert">{error}</p><button type="button" onClick={() => setIntento((n) => n + 1)} className="mt-4 rounded-lg border px-4 py-2">Reintentar</button></> : <p role="status" className="flex items-center gap-2"><Loader2 aria-hidden className="h-4 w-4 animate-spin" />Cargando opciones…</p>)}
    </div>
  </div>
}
