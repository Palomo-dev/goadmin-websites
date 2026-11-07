'use client'

/**
 * Dibujo del plano de mesas de una sede para la reserva (Figma 2223:46106 lámina 03).
 *
 * SVG escalable: cabe a lo ancho en el celular y se acerca con dos dedos (el zoom del navegador).
 * Cada mesa disponible es un botón (teclado: Tab + Enter/Espacio); las demás se ven atenuadas y no
 * se pueden elegir. Colores: solo las variables del tema (`--text-color`, `--background-color`,
 * `--primary-color`), como pide el contrato del café.
 */

import type { KeyboardEvent } from 'react'
import {
  cajaElemento,
  cajaMesa,
  lienzoDelPlano,
  recuadrosDeZona,
  sillasDeMesa,
  tamanoMesa,
  type EstadoMesaWeb,
  type MesaDelPlano,
  type PlanoSede,
} from '@/lib/restaurant/planoMesas'

export interface PlanoMesasProps {
  plano: PlanoSede
  estados: Record<string, EstadoMesaWeb>
  elegida: string | null
  onElegir: (mesa: MesaDelPlano) => void
  mostrarCapacidad: boolean
  /** Atenuar las que no alcanzan para el grupo (`dim_small_tables`). Sin esto, solo se bloquean. */
  atenuarPequenas: boolean
  estilo: 'line' | 'filled'
  etiqueta: string
}

const TEXTO = 'var(--text-color, #1f2937)'
const FONDO = 'var(--background-color, #ffffff)'
const PRIMARIO = 'var(--primary-color, #374151)'

const NOMBRE_ESTADO: Record<EstadoMesaWeb, string> = {
  libre: 'disponible',
  ocupada: 'no disponible a esa hora',
  no_alcanza: 'no alcanza para el grupo',
  no_web: 'no se reserva en línea',
}

function Elemento({ e }: { e: PlanoSede['elementos'][number] }) {
  const c = cajaElemento(e)
  const cx = e.x + c.w / 2
  const cy = e.y + c.h / 2
  const x = -e.ancho / 2
  const y = -e.alto / 2
  const etiqueta = e.etiqueta || (e.tipo === 'column' ? 'Columna' : e.tipo === 'bar' ? 'Barra' : e.tipo === 'planter' ? 'Jardinera' : e.tipo === 'door' ? 'Entrada' : '')
  let figura: React.ReactNode
  switch (e.tipo) {
    case 'column':
      figura = <rect x={x} y={y} width={e.ancho} height={e.alto} rx={2} style={{ fill: TEXTO }} />
      break
    case 'wall':
      figura = <rect x={x} y={y} width={e.ancho} height={e.alto} style={{ fill: TEXTO }} />
      break
    case 'planter': {
      const r = Math.min(e.ancho, e.alto) / 2
      figura = (
        <g>
          <ellipse cx={0} cy={0} rx={e.ancho / 2} ry={e.alto / 2} style={{ fill: `color-mix(in srgb, ${PRIMARIO} 22%, ${FONDO})`, stroke: `color-mix(in srgb, ${PRIMARIO} 45%, transparent)` }} />
          {[-0.4, 0, 0.4].map((k, i) => (
            <circle key={i} cx={k * e.ancho * 0.6} cy={(i % 2 ? 0.15 : -0.1) * e.alto} r={Math.max(3, r * 0.16)} style={{ fill: `color-mix(in srgb, ${PRIMARIO} 55%, ${FONDO})` }} />
          ))}
        </g>
      )
      break
    }
    case 'bar':
      figura = <rect x={x} y={y} width={e.ancho} height={e.alto} rx={4} style={{ fill: `color-mix(in srgb, ${TEXTO} 14%, ${FONDO})`, stroke: `color-mix(in srgb, ${TEXTO} 35%, transparent)` }} />
      break
    case 'window':
      figura = <rect x={x} y={y} width={e.ancho} height={e.alto} style={{ fill: `color-mix(in srgb, ${PRIMARIO} 12%, ${FONDO})`, stroke: `color-mix(in srgb, ${TEXTO} 40%, transparent)` }} />
      break
    case 'door':
      figura = <path d={`M ${x} ${y + e.alto} L ${x + e.ancho} ${y + e.alto} M ${x} ${y + e.alto} A ${e.ancho} ${e.ancho} 0 0 1 ${x + e.ancho} ${y + e.alto - e.ancho}`} style={{ fill: 'none', stroke: `color-mix(in srgb, ${TEXTO} 45%, transparent)`, strokeDasharray: '4 3' }} />
      break
    default:
      figura = null
  }
  const oscuro = e.tipo === 'column' || e.tipo === 'wall'
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${e.rotacion})`} aria-hidden="true">
      {figura}
      {etiqueta && (
        <text
          x={0}
          y={e.tipo === 'planter' || e.tipo === 'door' ? e.alto / 2 + 14 : 4}
          textAnchor="middle"
          fontSize={e.tipo === 'label' ? 15 : 11}
          style={{ fill: oscuro ? FONDO : `color-mix(in srgb, ${TEXTO} 70%, transparent)` }}
          transform={e.rotacion ? `rotate(${-e.rotacion})` : undefined}
        >
          {etiqueta}
        </text>
      )}
    </g>
  )
}

function Mesa({
  mesa,
  estado,
  elegida,
  onElegir,
  mostrarCapacidad,
  atenuarPequenas,
  estilo,
}: {
  mesa: MesaDelPlano
  estado: EstadoMesaWeb
  elegida: boolean
  onElegir: (m: MesaDelPlano) => void
  mostrarCapacidad: boolean
  atenuarPequenas: boolean
  estilo: 'line' | 'filled'
}) {
  const caja = cajaMesa(mesa)
  if (!caja) return null
  const t = tamanoMesa(mesa.forma, mesa.tamano)
  const cx = caja.x + caja.w / 2
  const cy = caja.y + caja.h / 2
  const libre = estado === 'libre'
  const apagada = !libre && (estado !== 'no_alcanza' || atenuarPequenas)
  const relleno = elegida ? TEXTO : apagada ? `color-mix(in srgb, ${TEXTO} 10%, ${FONDO})` : estilo === 'filled' ? `color-mix(in srgb, ${TEXTO} 8%, ${FONDO})` : FONDO
  const trazo = elegida ? TEXTO : apagada ? `color-mix(in srgb, ${TEXTO} 30%, transparent)` : TEXTO
  const letra = elegida ? FONDO : apagada ? `color-mix(in srgb, ${TEXTO} 45%, transparent)` : TEXTO
  // La mesa ocupa el 78 % de su caja: el resto es para las sillas (como POS › Mesas).
  const sillas = sillasDeMesa(mesa.forma, t.w * 0.78, t.h * 0.78, mesa.capacidad)
  const w = t.w * 0.78
  const h = t.h * 0.78
  const alTecla = (e: KeyboardEvent<SVGGElement>) => {
    if (libre && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onElegir(mesa)
    }
  }
  const nombre = `${mesa.nombre}${mesa.zona ? `, ${mesa.zona}` : ''}, hasta ${mesa.capacidad} ${mesa.capacidad === 1 ? 'persona' : 'personas'}: ${elegida ? 'elegida' : NOMBRE_ESTADO[estado]}`
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      role="button"
      tabIndex={libre ? 0 : -1}
      aria-pressed={elegida}
      aria-disabled={!libre}
      aria-label={nombre}
      onClick={() => libre && onElegir(mesa)}
      onKeyDown={alTecla}
      className={libre ? 'cursor-pointer outline-none [&:focus-visible>g>.foco]:opacity-100' : 'cursor-not-allowed'}
      data-mesa={mesa.id}
      data-estado={elegida ? 'elegida' : estado}
    >
      <g transform={`rotate(${mesa.rotacion})`}>
        {sillas.map((s, i) => (
          <rect
            key={i}
            x={-6}
            y={-4}
            width={12}
            height={8}
            rx={3}
            transform={`translate(${s.x} ${s.y}) rotate(${s.giro})`}
            style={{ fill: elegida ? TEXTO : FONDO, stroke: trazo, strokeWidth: 1.2 }}
          />
        ))}
        <rect className="foco opacity-0" x={-w / 2 - 14} y={-h / 2 - 14} width={w + 28} height={h + 28} rx={mesa.forma === 'redonda' ? (w + 28) / 2 : 10} style={{ fill: 'none', stroke: PRIMARIO, strokeWidth: 2, strokeDasharray: '4 3' }} />
        {mesa.forma === 'redonda' ? (
          <ellipse cx={0} cy={0} rx={w / 2} ry={h / 2} style={{ fill: relleno, stroke: trazo, strokeWidth: 1.5 }} />
        ) : (
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} style={{ fill: relleno, stroke: trazo, strokeWidth: 1.5 }} />
        )}
      </g>
      <text x={0} y={mostrarCapacidad ? -1 : 5} textAnchor="middle" fontSize={15} fontWeight={500} style={{ fill: letra }}>
        {mesa.nombre}
      </text>
      {mostrarCapacidad && (
        <text x={0} y={16} textAnchor="middle" fontSize={12} style={{ fill: letra, opacity: 0.75 }}>
          {mesa.capacidad}
        </text>
      )}
    </g>
  )
}

export function PlanoMesas({ plano, estados, elegida, onElegir, mostrarCapacidad, atenuarPequenas, estilo, etiqueta }: PlanoMesasProps) {
  const lienzo = lienzoDelPlano(plano)
  if (!lienzo) return null
  const zonas = recuadrosDeZona(plano)
  return (
    <svg
      viewBox={`${lienzo.x} ${lienzo.y} ${lienzo.w} ${lienzo.h}`}
      className="h-auto w-full select-none touch-manipulation"
      role="group"
      aria-label={etiqueta}
      style={{ fontFamily: 'var(--font-body), ui-sans-serif, system-ui, sans-serif' }}
    >
      {zonas.map((z) => (
        <g key={z.nombre} aria-hidden="true">
          <rect x={z.caja.x} y={z.caja.y} width={z.caja.w} height={z.caja.h} rx={6} style={{ fill: 'none', stroke: TEXTO, strokeWidth: 2 }} />
          {zonas.length > 1 && (
            <text x={z.caja.x + 14} y={z.caja.y + 20} fontSize={12} style={{ fill: `color-mix(in srgb, ${TEXTO} 65%, transparent)` }}>
              {z.nombre}
            </text>
          )}
        </g>
      ))}
      {plano.elementos.map((e) => (
        <Elemento key={e.id} e={e} />
      ))}
      {plano.mesas.map((m) => (
        <Mesa
          key={m.id}
          mesa={m}
          estado={estados[m.id] ?? 'libre'}
          elegida={elegida === m.id}
          onElegir={onElegir}
          mostrarCapacidad={mostrarCapacidad}
          atenuarPequenas={atenuarPequenas}
          estilo={estilo}
        />
      ))}
    </svg>
  )
}
