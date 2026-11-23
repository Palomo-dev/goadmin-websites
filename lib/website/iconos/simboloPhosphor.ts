/**
 * Dibujo de un ícono de Phosphor listo para `<svg><use href="…#g"/></svg>` (Figma 2852:70951,
 * propuesta 8 «Íconos con más estilos»). Lo sirve `app/api/iconos/[peso]/[nombre]/route.ts`.
 *
 * Toma el SVG del paquete (`@phosphor-icons/core/assets/<peso>/<nombre>[-<peso>].svg`) y deja
 * solo sus figuras dentro de un `<symbol id="g">`: así la tienda lo pinta con el color del texto
 * (`fill="currentColor"` en el `<svg>` que lo usa) y el navegador lo descarga una sola vez.
 *
 * Puro (lo prueba scripts/verify-glifos-tienda.mjs).
 */
import { PESOS_GLIFO, kebabPhosphor, nombrePhosphorValido, type PesoGlifo } from '../v2/glifosTienda'

/** Archivo del paquete para un nombre y un peso, o `null` si el pedido no es válido. */
export function archivoPhosphor(peso: string, nombreConExtension: string): { peso: PesoGlifo; archivo: string } | null {
  if (!(PESOS_GLIFO as readonly string[]).includes(peso)) return null
  const nombre = nombreConExtension.endsWith('.svg') ? nombreConExtension.slice(0, -4) : nombreConExtension
  if (!nombrePhosphorValido(nombre)) return null
  const p = peso as PesoGlifo
  return { peso: p, archivo: `${kebabPhosphor(nombre)}${p === 'regular' ? '' : `-${p}`}.svg` }
}

/** Solo figuras: nada de scripts, eventos, enlaces ni estilos. */
const ETIQUETAS_PERMITIDAS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g'])

/** `<svg>` con el `<symbol id="g">` del dibujo, o `null` si el archivo trae algo que no es una figura. */
export function simboloDesdeSvg(svg: string): string | null {
  const inicio = svg.indexOf('>', svg.indexOf('<svg'))
  const fin = svg.lastIndexOf('</svg>')
  if (inicio < 0 || fin < inicio) return null
  const cuerpo = svg.slice(inicio + 1, fin).trim()
  if (!cuerpo) return null
  for (const m of cuerpo.matchAll(/<\/?([a-zA-Z][\w:-]*)/g)) {
    if (!ETIQUETAS_PERMITIDAS.has(m[1].toLowerCase())) return null
  }
  if (/\son[a-z]+\s*=|href|javascript:|style\s*=/i.test(cuerpo)) return null
  return `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="g" viewBox="0 0 256 256">${cuerpo}</symbol></svg>`
}
