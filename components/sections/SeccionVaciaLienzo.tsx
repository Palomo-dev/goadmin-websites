'use client'

import { BedDouble, ExternalLink, Package, SquareParking, Tags } from 'lucide-react'

/**
 * Estado vacío de una sección en el lienzo del editor cuando faltan datos del ERP
 * (Figma «SeccionVaciaLienzo» 1886:919306).
 *
 * SOLO en modo preview (`?preview=1`) y solo cuando el editor del ERP marca la sección con
 * `aviso` en `goadmin:preview`: el ERP cuenta los registros de la organización y decide.
 * Fuera del editor este componente no se monta nunca.
 *
 * «Ir a …» es un enlace normal al módulo del ERP (otra pestaña). «Quitar sección» lo atiende
 * `PreviewBridge` (`data-goadmin-accion`): avisa al editor con `goadmin:accion` y el editor pide
 * confirmación antes de quitarla.
 */
export interface AvisoLienzo {
  titulo: string
  descripcion: string
  accion?: { texto: string; href: string } | null
}

const ICONO: Record<string, typeof Package> = {
  room_types: BedDouble,
  categories_grid: Tags,
  parking_zones: SquareParking,
  parking_availability: SquareParking,
  parking_pricing: SquareParking,
  parking_pass_plans: SquareParking,
}

/** Solo enlaces http(s): el `href` llega por postMessage de un origen ya validado, pero no se confía. */
function hrefSeguro(href: string | undefined): string | null {
  if (!href) return null
  try {
    const url = new URL(href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function SeccionVaciaLienzo({
  sectionId,
  sectionType,
  aviso,
}: {
  sectionId: string
  sectionType: string
  aviso: AvisoLienzo
}) {
  const Icono = ICONO[sectionType] ?? Package
  const href = hrefSeguro(aviso.accion?.href)
  return (
    <section data-section-id={sectionId} data-goadmin-vacia="" className="mx-auto my-4 max-w-5xl px-4">
      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-amber-300 bg-white px-6 py-8 text-center">
        <span className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
          Solo lo ves en el editor
        </span>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <Icono aria-hidden className="h-7 w-7 text-amber-600" />
        </span>
        <p className="text-base font-semibold text-slate-900">{aviso.titulo}</p>
        <p className="max-w-[520px] text-[13px] leading-[18px] text-slate-600">{aviso.descripcion}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {href && aviso.accion ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              data-goadmin-accion="ir"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#3651d4] px-3 text-xs font-medium text-white hover:bg-[#2a3ea8]"
            >
              <ExternalLink aria-hidden className="h-4 w-4" />
              {aviso.accion.texto}
            </a>
          ) : null}
          <button
            type="button"
            data-goadmin-accion="quitar"
            className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
          >
            Quitar sección
          </button>
        </div>
      </div>
    </section>
  )
}
