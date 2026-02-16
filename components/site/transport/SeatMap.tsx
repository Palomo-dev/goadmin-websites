'use client'

import { useState } from 'react'

interface TripSeat {
  id: string
  seat_label: string
  status: 'available' | 'reserved' | 'sold' | 'blocked'
  reserved_until: string | null
  vehicle_seats: {
    seat_row: number
    seat_column: number
    seat_type: string
    position_x: number | null
    position_y: number | null
    price_modifier: number | null
    is_available: boolean
  } | null
}

interface SeatMapProps {
  seats: TripSeat[]
  selectedSeats: string[]
  onToggleSeat: (seatId: string, seatLabel: string) => void
  primaryColor: string
  maxSelectable?: number
}

const SEAT_SIZE = 40
const GAP = 6
const PADDING = 20

function getSeatColor(seat: TripSeat, isSelected: boolean, primaryColor: string): string {
  if (isSelected) return primaryColor
  switch (seat.status) {
    case 'available': return '#e5e7eb'
    case 'reserved': return '#fcd34d'
    case 'sold': return '#ef4444'
    case 'blocked': return '#9ca3af'
    default: return '#e5e7eb'
  }
}

function getSeatTextColor(seat: TripSeat, isSelected: boolean): string {
  if (isSelected) return '#ffffff'
  switch (seat.status) {
    case 'sold': return '#ffffff'
    default: return '#374151'
  }
}

export function SeatMap({ seats, selectedSeats, onToggleSeat, primaryColor, maxSelectable = 8 }: SeatMapProps) {
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null)

  if (!seats.length) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500 text-sm">
        No hay información de asientos disponible
      </div>
    )
  }

  // Calcular grid basado en position_x/y o seat_row/column
  const seatPositions = seats.map(seat => {
    const vs = seat.vehicle_seats
    const row = vs?.position_y ?? vs?.seat_row ?? 0
    const col = vs?.position_x ?? vs?.seat_column ?? 0
    return { ...seat, row, col }
  })

  const maxRow = Math.max(...seatPositions.map(s => s.row), 0)
  const maxCol = Math.max(...seatPositions.map(s => s.col), 0)

  const svgWidth = (maxCol + 1) * (SEAT_SIZE + GAP) + PADDING * 2
  const svgHeight = (maxRow + 1) * (SEAT_SIZE + GAP) + PADDING * 2 + 40 // +40 para header

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="mx-auto"
        >
          {/* Header del vehículo */}
          <rect x={0} y={0} width={svgWidth} height={30} rx={8} fill="#f3f4f6" />
          <text x={svgWidth / 2} y={20} textAnchor="middle" fontSize={11} fill="#6b7280" fontWeight={500}>
            Frente del vehículo
          </text>

          {/* Asientos */}
          {seatPositions.map(seat => {
            const isSelected = selectedSeats.includes(seat.id)
            const isAvailable = seat.status === 'available'
            const isHovered = hoveredSeat === seat.id
            const x = PADDING + seat.col * (SEAT_SIZE + GAP)
            const y = 40 + PADDING + seat.row * (SEAT_SIZE + GAP)
            const fill = getSeatColor(seat, isSelected, primaryColor)
            const textFill = getSeatTextColor(seat, isSelected)

            return (
              <g
                key={seat.id}
                onClick={() => {
                  if (!isAvailable && !isSelected) return
                  if (!isSelected && selectedSeats.length >= maxSelectable) return
                  onToggleSeat(seat.id, seat.seat_label)
                }}
                onMouseEnter={() => setHoveredSeat(seat.id)}
                onMouseLeave={() => setHoveredSeat(null)}
                style={{ cursor: isAvailable || isSelected ? 'pointer' : 'not-allowed' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={SEAT_SIZE}
                  height={SEAT_SIZE}
                  rx={6}
                  fill={fill}
                  stroke={isHovered && isAvailable ? primaryColor : 'transparent'}
                  strokeWidth={2}
                  opacity={!isAvailable && !isSelected ? 0.6 : 1}
                />
                <text
                  x={x + SEAT_SIZE / 2}
                  y={y + SEAT_SIZE / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={600}
                  fill={textFill}
                >
                  {seat.seat_label}
                </text>
                {/* Modifier badge */}
                {seat.vehicle_seats?.price_modifier && seat.vehicle_seats.price_modifier > 0 && isAvailable && (
                  <text
                    x={x + SEAT_SIZE - 2}
                    y={y + 10}
                    textAnchor="end"
                    fontSize={8}
                    fill="#f59e0b"
                    fontWeight={700}
                  >
                    +$
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 justify-center text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-gray-200 border" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: primaryColor }} />
          <span>Seleccionado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-yellow-300" />
          <span>Reservado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span>Vendido</span>
        </div>
      </div>
    </div>
  )
}
