'use client'

import { useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Check, AlertCircle } from 'lucide-react'

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

export const ProductModifierSelector = forwardRef<ProductModifierSelectorRef, ProductModifierSelectorProps>(
  function ProductModifierSelector({ groups, primaryColor, onChange }, ref) {
  const [selectedByGroup, setSelectedByGroup] = useState<Record<number, Set<number>>>({})
  const [error, setError] = useState<string | null>(null)

  const toggleModifier = (group: ModifierGroup, modifierId: number) => {
    setError(null)
    setSelectedByGroup((prev) => {
      const current = new Set(prev[group.id] || [])
      if (group.selection_mode === 'single') {
        if (current.has(modifierId)) {
          if (!group.required) current.clear()
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

  const validate = (): boolean => {
    for (const group of groups) {
      const count = (selectedByGroup[group.id] || new Set()).size
      const minRequired = group.required ? Math.max(group.min_selections, 1) : group.min_selections
      if (count < minRequired) {
        setError(
          minRequired > 1
            ? `Selecciona al menos ${minRequired} opciones en "${group.name}"`
            : `Selecciona una opción en "${group.name}"`
        )
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
        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-900 dark:text-white">
                {group.name}
                {group.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {group.selection_mode === 'single' ? 'Elige 1' : group.max_selections ? `Máx. ${group.max_selections}` : 'Múltiple'}
              </span>
            </div>
            <div className="space-y-1.5">
              {group.product_modifiers.map((opt) => {
                const isSelected = selectedIds.has(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
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
                    {Number(opt.extra_price) > 0 && (
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        +${Number(opt.extra_price).toLocaleString('es-CO')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {extraTotal > 0 && (
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 pt-1 border-t dark:border-gray-700">
          Extras: <span style={{ color: primaryColor }}>+${extraTotal.toLocaleString('es-CO')}</span>
        </div>
      )}

    </div>
  )
  }
)
