/**
 * Ícono de una acción de la cabecera con su dibujo del catálogo nuevo (`header_iconos.glifos`) y
 * el «Estilo de los íconos» de la cabecera (`header_iconos.iconStyle`), Figma 2852:70951.
 * Sin ninguna de las dos claves devuelve el mismo componente de Lucide de hoy.
 */
import type { LucideIcon } from 'lucide-react'
import { estiloGlifosCabecera, glifosCabecera, type IconoCabeceraGlifo } from '@/lib/website/v2/glifosTienda'
import { conGlifo } from './GlifoTienda'

function ajustesDe(settings: unknown): Record<string, unknown> | null {
  return settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : null
}

/** `base` es el de hoy (ya resuelto por nombre); `nombre`, el nombre de Lucide guardado. */
export function iconoCabecera(base: LucideIcon, icono: IconoCabeceraGlifo, nombre: string | null, settings: unknown): LucideIcon {
  const a = ajustesDe(settings)
  return conGlifo(base, { glifo: glifosCabecera(a)[icono] ?? null, nombre, estilo: estiloGlifosCabecera(a) })
}
