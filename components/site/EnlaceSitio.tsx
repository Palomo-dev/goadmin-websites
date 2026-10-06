'use client'

/**
 * `next/link` con el prefijo de la sede de la petición (`useRutaSitio`), para enlaces internos
 * que se pintan desde componentes de SERVIDOR (secciones del constructor). En componentes
 * cliente basta con `const { ruta } = useRutaSitio()` y `href={ruta('/x')}`.
 *
 * Sin sede por prefijo el `href` queda tal cual: el sitio principal no cambia.
 */

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

type EnlaceSitioProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string }

export function EnlaceSitio({ href, ...resto }: EnlaceSitioProps) {
  const { ruta } = useRutaSitio()
  return <Link href={ruta(href)} {...resto} />
}
