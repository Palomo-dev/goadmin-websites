'use client'

import { useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { gruposVisibles, mensajeObligatorio, minimoExigido } from '@/lib/products/modificadores'

export interface ModifierGroup {
  id: number
  name: string
  selection_mode: 'single' | 'multiple'
  min_selections: number
  max_selections: number | null
  required: boolean
  display_order: number
  product_modifiers: ModifierOption[]
}

export interface ModifierOption {
  id: number
  name: string
  extra_price: number
  is_active: boolean
  display_order: number
}

export interface SelectedModifier {
  groupId: number
  groupName: string
  modifierId: number
  name: string
  extraPrice: number
}

export interface ProductModifierSelectorRef {
  validate: () => boolean
  getExtraTotal: () => number
  getSelected: () => SelectedModifier[]
}

interface ProductModifierSelectorProps {
  groups: ModifierGroup[]
  primaryColor: string
  onChange: (selected: SelectedModifier[]) => void
}

/** «obligatorio, elige 1» / «opcional, hasta 3» (Figma, hoja del plato). */
function reglaDelGrupo(group: ModifierGroup): string {
  const minimo = minimoExigido(group)
  if (minimo > 0) {
    if (group.selection_mode === 'single') return 'obligatorio, elige 1'
    return group.max_selections && group.max_selections > minimo
      ? `obligatorio, elige de ${minimo} a ${group.max_selections}`
      : `obligatorio, elige ${minimo}`
  }
  if (group.selection_mode === 'single') return 'opcional, elige 1'
  return group.max_selections ? `opcional, hasta ${group.max_selections}` : 'opcional'
}

export const ProductModifierSelector = forwardRef<ProductModifierSelectorRef, ProductModifierSelectorProps>(
  function ProductModifierSelector({ groups: gruposEntrada, primaryColor, onChange }, ref) {
  // Solo grupos con opciones activas: uno vacío y obligatorio bloquearía el plato para siempre.
  const groups = useMemo(
    () =>
      gruposVisibles(
        gruposEntrada.map((g) => ({ ...g, product_modifiers: (g.product_modifiers || []).filter((m) => m.is_active !== false) })),
      ),
    [gruposEntrada],
  )
  const { formatPrice } = useCurrency()
  const [selectedByGroup, setSelectedByGroup] = useState<Record<number, Set<number>>>({})
  const [error, setError] = useState<string | null>(null)
  const [grupoConError, setGrupoConError] = useState<number | null>(null)

  const toggleModifier = (group: ModifierGroup, modifierId: number) => {
    setError(null)
    setGrupoConError(null)
    setSelectedByGroup((prev) => {
      const current = new Set(prev[group.id] || [])
      if (group.selection_mode === 'single') {
        if (current.has(modifierId)) {
          if (minimoExigido(group) === 0) current.clear()
        } else {
          current.clear()
          current.add(modifierId)
        }
      } else {
        if (current.has(modifierId)) {
          current.delete(modifierId)
        } else {
          if (group.max_selections && current.size >= group.max_selections) {
            return prev
          }
          current.add(modifierId)
        }
      }
      const newSelected = { ...prev, [group.id]: current }
      emitChange(newSelected)
      return newSelected
    })
  }

  const emitChange = (selected: Record<number, Set<number>>) => {
    const result: SelectedModifier[] = []
    for (const group of groups) {
      const ids = selected[group.id] || new Set()
      for (const opt of group.product_modifiers) {
        if (ids.has(opt.id)) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            modifierId: opt.id,
            name: opt.name,
            extraPrice: Number(opt.extra_price) || 0,
          })
        }
      }
    }
    onChange(result)
  }

  // Misma regla y mismo texto que el servidor (lib/products/modificadores.ts).
  const validate = (): boolean => {
    for (const group of groups) {
      const count = (selectedByGroup[group.id] || new Set()).size
      const minimo = minimoExigido(group)
      if (count < minimo) {
        setError(mensajeObligatorio(group, minimo))
        setGrupoConError(group.id)
        document.getElementById(`grupo-mod-${group.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        return false
      }
    }
    return true
  }

  const extraTotal = useMemo(() => {
    let total = 0
    for (const group of groups) {
      const ids = selectedByGroup[group.id] || new Set()
      for (const opt of group.product_modifiers) {
        if (ids.has(opt.id)) {
          total += Number(opt.extra_price) || 0
        }
      }
    }
    return total
  }, [selectedByGroup, groups])

  const selectedModifiers: SelectedModifier[] = useMemo(() => {
    const result: SelectedModifier[] = []
    for (const group of groups) {
      const ids = selectedByGroup[group.id] || new Set()
      for (const opt of group.product_modifiers) {
        if (ids.has(opt.id)) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            modifierId: opt.id,
            name: opt.name,
            extraPrice: Number(opt.extra_price) || 0,
          })
        }
      }
    }
    return result
  }, [selectedByGroup, groups])

  useImperativeHandle(ref, () => ({
    validate,
    getExtraTotal: () => extraTotal,
    getSelected: () => selectedModifiers,
  }))

  if (groups.length === 0) return null

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const selectedIds = selectedByGroup[group.id] || new Set()
        const conError = grupoConError === group.id
        return (
          <fieldset
            key={group.id}
            id={`grupo-mod-${group.id}`}
            className="space-y-2"
            aria-invalid={conError || undefined}
            aria-describedby={conError ? `grupo-mod-${group.id}-error` : undefined}
          >
            <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
              {group.name}
              <span className="font-normal text-gray-500 dark:text-gray-400"> · {reglaDelGrupo(group)}</span>
            </legend>
            <div className="space-y-1.5" role={group.selection_mode === 'single' ? 'radiogroup' : 'group'} aria-label={group.name}>
              {group.product_modifiers.map((opt) => {
                const isSelected = selectedIds.has(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role={group.selection_mode === 'single' ? 'radio' : 'checkbox'}
                    aria-checked={isSelected}
                    onClick={() => toggleModifier(group, opt.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'border-2 bg-gray-50 dark:bg-gray-800'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={isSelected ? { borderColor: primaryColor } : {}}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex items-center justify-center ${
                          group.selection_mode === 'single' ? 'w-5 h-5 rounded-full' : 'w-5 h-5 rounded'
                        } border-2 transition-colors`}
                        style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{opt.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {Number(opt.extra_price) > 0 ? `+ ${formatPrice(Number(opt.extra_price))}` : 'incluido'}
                    </span>
                  </button>
                )
              })}
            </div>
            {conError && error && (
              <p id={`grupo-mod-${group.id}-error`} role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </fieldset>
        )
      })}

      {extraTotal > 0 && (
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 pt-1 border-t dark:border-gray-700">
          Extras: <span style={{ color: primaryColor }}>+ {formatPrice(extraTotal)}</span>
        </div>
      )}

    </div>
  )
  }
)
