/**
 * Filas de «Envío y devoluciones» (Figma «16 Sitio web», bloque 2, opción B del dueño, 2026-11-25).
 *
 * Lo que dice cada línea de envío, igual en el bloque, en su pestaña y en la parte «Envío» de la
 * Descripción. Dato real del ERP si existe; si no, el texto del editor (vacío = la frase de siempre).
 * - Tiempo de entrega: la promesa de las zonas de envío activas («2 a 4 días»).
 * - Costo de envío: con «envío gratis desde» (el mismo de la barra de arriba), el umbral.
 * - Devoluciones y cobertura: siempre el texto del comercio (no hay dato en el ERP).
 * Los interruptores del bloque apagan cada línea (sin la clave, encendidas: lo de hoy).
 *
 * Puro (sin React ni Supabase). Va aparte de `anclasFicha.ts`, que no puede tener imports.
 */
import { leerTextosEnvio } from '../../../lib/website/v2/seccionesFicha'
import type { ResumenEnvioFicha } from './anclasFicha'

export type ClaveFilaEnvio = 'entrega' | 'costo' | 'devoluciones' | 'cobertura'

export interface FilaEnvioFicha {
  clave: ClaveFilaEnvio
  texto: string
}

function pesos(n: number): string {
  return `$ ${Math.round(n).toLocaleString('es-CO')}`
}

export function filasEnvioFicha(content: Record<string, unknown> | null | undefined, resumen: ResumenEnvioFicha | null | undefined): FilaEnvioFicha[] {
  const c = content ?? {}
  const t = leerTextosEnvio(c)
  const filas: FilaEnvioFicha[] = []
  if (c.show_delivery_time !== false) {
    filas.push({ clave: 'entrega', texto: resumen?.llega ? resumen.llega.replace(/^Llega en /, '') : t.entrega })
  }
  if (c.show_shipping_cost !== false) {
    filas.push({
      clave: 'costo',
      texto: resumen?.umbral ? `Gratis en compras desde ${pesos(resumen.umbral)}. Por debajo, se calcula al finalizar la compra.` : t.costo,
    })
  }
  if (c.show_return_policy !== false) filas.push({ clave: 'devoluciones', texto: t.devoluciones })
  if (t.conCobertura) filas.push({ clave: 'cobertura', texto: t.cobertura })
  return filas
}
