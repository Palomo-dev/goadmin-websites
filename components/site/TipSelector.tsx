'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Heart } from 'lucide-react'

interface TipSelectorProps {
  subtotal: number
  value: number
  onChange: (amount: number) => void
  primaryColor: string
}

const TIP_PERCENTAGES = [0, 5, 10, 15]

export function TipSelector({ subtotal, value, onChange, primaryColor }: TipSelectorProps) {
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const currentPercent = subtotal > 0 ? Math.round((value / subtotal) * 100) : 0
  const isPreset = TIP_PERCENTAGES.includes(currentPercent) && !customMode

  const selectPercent = (pct: number) => {
    setCustomMode(false)
    setCustomValue('')
    onChange(Math.round(subtotal * pct / 100))
  }

  const handleCustom = (val: string) => {
    setCustomValue(val)
    const num = parseInt(val) || 0
    onChange(num)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Heart className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Propina (opcional)</h3>
      </div>
      <div className="flex gap-2 flex-wrap">
        {TIP_PERCENTAGES.map(pct => {
          const isSelected = isPreset && currentPercent === pct
          return (
            <button
              key={pct}
              type="button"
              onClick={() => selectPercent(pct)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isSelected
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }`}
              style={isSelected ? { backgroundColor: primaryColor } : {}}
            >
              {pct === 0 ? 'Sin propina' : `${pct}%`}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => { setCustomMode(true); onChange(0); setCustomValue('') }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            customMode
              ? 'text-white border-transparent'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
          }`}
          style={customMode ? { backgroundColor: primaryColor } : {}}
        >
          Otro
        </button>
      </div>
      {customMode && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-gray-500 font-medium">$</span>
          <Input
            type="number"
            min="0"
            placeholder="Monto de propina"
            value={customValue}
            onChange={(e) => handleCustom(e.target.value)}
            className="w-40"
            autoFocus
          />
        </div>
      )}
      {value > 0 && (
        <p className="text-xs text-gray-500">
          Propina: <span className="font-medium" style={{ color: primaryColor }}>${value.toLocaleString()}</span>
        </p>
      )}
    </div>
  )
}
