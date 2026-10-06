'use client'

/**
 * Carta QR en la mesa — piezas comunes de las secciones de mesa: el arranque de cada sección
 * (mesa del QR, almacén compartido, vista previa del editor), la hoja inferior, botones,
 * píldoras de estado y el encabezado de las pantallas.
 */

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useMesaQR } from '@/lib/restaurant/useMesaQR'
import type { MesaGuardada } from '@/lib/restaurant/mesaQR'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'
import { ETIQUETA_ESTADO_RONDA, type EstadoRonda } from '@/lib/restaurant/mesa-modelo'
import { fijarMesa, irA, registrarSeccionMesa, useMesaQRStore } from '@/lib/restaurant/mesaStore'
import { C, TITULO, estiloEstado } from './estilo'
import { MESA_MUESTRA } from './muestra'

/** Lo mínimo de la organización que necesitan las secciones de mesa (viaja al navegador). */
export interface OrganizacionMesa {
  id: number
  name: string
  subdomain: string | null
}

export interface PropsSeccionMesa {
  content: Record<string, unknown>
  organization: OrganizacionMesa
  /** Solo `branchId` y `sedesRestaurante`: el resto de los datos de la página no viaja. */
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string
}

/**
 * Arranque común: registra la sección en el almacén, resuelve la mesa del QR (una sola consulta
 * por página) y, en el lienzo del editor sin QR, usa la mesa de muestra.
 */
export function useSeccionMesa(props: PropsSeccionMesa, seccion?: 'pedido' | 'cuenta' | 'valorar' | 'servicio'): {
  mesa: MesaGuardada | null
  preview: boolean
} {
  const subdomain = props.organization.subdomain || ''
  const branchId = typeof props.data?.branchId === 'number' ? (props.data.branchId as number) : null
  const preview = useIsPreviewMode()
  const { mesa } = useMesaQR(subdomain, branchId)
  useEffect(() => {
    registrarSeccionMesa({ subdomain, branchId, organizationId: props.organization.id ?? null, seccion })
  }, [subdomain, branchId, props.organization.id, seccion])
  useEffect(() => {
    if (mesa) fijarMesa(mesa)
  }, [mesa])
  const mesaStore = useMesaQRStore((e) => e.mesa)
  return { mesa: mesaStore ?? mesa ?? (preview ? MESA_MUESTRA : null), preview }
}

/** Nombre de la sede y la zona de la mesa: «Terraza · Sede Centro». */
export function lugarDeMesa(mesa: MesaGuardada | null): string {
  return [mesa?.zona, mesa?.nombreSede].filter(Boolean).join(' · ')
}

export function Pildora({ estado, texto }: { estado: EstadoRonda; texto?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={estiloEstado(estado)}>
      {texto ?? ETIQUETA_ESTADO_RONDA[estado]}
    </span>
  )
}

export function BotonPrimario({
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
  style,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      style={{ backgroundColor: C.primario, ...style }}
    >
      {children}
    </button>
  )
}

export function BotonSecundario({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border px-4 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-60 ${className}`}
      style={{ borderColor: C.texto, color: C.texto, backgroundColor: 'transparent' }}
    >
      {children}
    </button>
  )
}

/** Encabezado de pantalla: flecha atrás, título serif y subtítulo (láminas 04, 08, 09). */
export function EncabezadoPantalla({ titulo, subtitulo, subtituloOk = false, onAtras }: {
  titulo: string
  subtitulo?: string | null
  subtituloOk?: boolean
  onAtras?: () => void
}) {
  return (
    <header className="sticky top-0 z-10 flex items-start gap-3 border-b px-4 pb-3 pt-4" style={{ backgroundColor: C.fondo, borderColor: C.borde }}>
      <button
        type="button"
        onClick={onAtras ?? (() => history.length > 1 ? history.back() : irA(''))}
        className="-ml-1 mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:opacity-80"
        aria-label="Volver"
        style={{ color: C.texto }}
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <h1 className="text-[26px] leading-8" style={TITULO}>{titulo}</h1>
        {subtitulo && (
          <p className="text-sm" style={{ color: subtituloOk ? '#2E6B3A' : C.suave }}>{subtitulo}</p>
        )}
      </div>
    </header>
  )
}

/**
 * Pantalla de la mesa: a pantalla completa en el sitio (encima de la página, con su propio
 * desplazamiento) y en el lienzo del editor, en línea, para verla y editarla como sección.
 */
export function PantallaMesa({ lienzo, children, pie, ancho = 'max-w-md' }: {
  lienzo: boolean
  children: ReactNode
  pie?: ReactNode
  ancho?: string
}) {
  if (lienzo) {
    return (
      <div className={`mx-auto flex w-full ${ancho} flex-col overflow-hidden rounded-xl border`} style={{ backgroundColor: C.fondo, borderColor: C.borde, color: C.texto }}>
        {children}
        {pie && <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: C.borde }}>{pie}</div>}
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: C.fondo, color: C.texto }} role="dialog" aria-modal="true">
      <div className="flex-1 overflow-y-auto">
        <div className={`mx-auto w-full ${ancho}`}>{children}</div>
      </div>
      {pie && (
        <div className="border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" style={{ borderColor: C.borde, backgroundColor: C.fondo }}>
          <div className={`mx-auto w-full ${ancho}`}>{pie}</div>
        </div>
      )}
    </div>
  )
}

/** Hoja inferior (láminas 05, 07, 14): velo, asa y contenido. */
export function HojaInferior({ abierta, onCerrar, children, etiqueta }: {
  abierta: boolean
  onCerrar: () => void
  children: ReactNode
  etiqueta: string
}) {
  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierta, onCerrar])
  if (!abierta) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={etiqueta}>
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Cerrar" onClick={onCerrar} />
      <div
        className="relative w-full max-w-md rounded-t-2xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-xl md:rounded-2xl"
        style={{ backgroundColor: C.fondo, color: C.texto }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: C.borde }} aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}

/** «Mesa 7» o el nombre que tenga la mesa. */
export function nombreMesa(mesa: MesaGuardada | null): string {
  return mesa?.nombre || 'Tu mesa'
}
