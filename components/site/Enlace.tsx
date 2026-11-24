'use client'

/**
 * `next/link` de la tienda, SIN precarga automática.
 *
 * Por qué: `next/link` precarga la página destino de cada enlace en cuanto aparece en pantalla.
 * Medido el 2026-11-24 en un navegador real sobre la tienda con más tráfico: 17 precargas por
 * ficha de producto y 44 por portada (26 eran fichas que casi nadie abre). Cada precarga pasa
 * por el middleware y ejecuta una función en Vercel. Y no ahorraban nada: las páginas de la
 * tienda son dinámicas y sin `loading.tsx`, así que la precarga solo traía el marco del sitio y
 * al hacer clic la página se pedía entera igual.
 *
 * Qué se conserva:
 * - Los enlaces al CHECKOUT siguen precargando: es la única ruta con `loading.tsx`
 *   (app/checkout/loading.tsx) y ahí la precarga sí hace que el clic responda al instante.
 * - Quien pase `prefetch` a mano manda: se respeta tal cual.
 * - Todo lo demás de `next/link` (navegación sin recarga, `replace`, `scroll`, `ref`…): es el
 *   mismo componente por debajo.
 *
 * Uso: `import Link from '@/components/site/Enlace'` en vez de `next/link`.
 * `scripts/verify-enlaces.mjs` falla si un archivo nuevo importa `next/link` directo.
 */

import NextLink from 'next/link'
import { forwardRef, type ComponentProps } from 'react'

type EnlaceProps = ComponentProps<typeof NextLink>

/** ¿El destino es el checkout? (`/checkout`, `/sede-norte/checkout`, con o sin `?…`). */
export function esRutaConPrecarga(href: EnlaceProps['href']): boolean {
  const ruta = typeof href === 'string' ? href : href?.pathname ?? ''
  return /\/checkout\/?$/.test(ruta.split(/[?#]/)[0])
}

const Enlace = forwardRef<HTMLAnchorElement, EnlaceProps>(function Enlace({ prefetch, href, ...resto }, ref) {
  // `undefined` = la precarga por defecto de Next (solo checkout); `false` = ninguna.
  const precarga = prefetch !== undefined ? prefetch : esRutaConPrecarga(href) ? undefined : false
  return <NextLink ref={ref} href={href} prefetch={precarga} {...resto} />
})

export default Enlace
