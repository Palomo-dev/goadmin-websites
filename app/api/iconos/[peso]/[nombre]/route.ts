/**
 * Dibujo de un ícono del catálogo nuevo (Phosphor), uno por pedido: `/api/iconos/duotone/ShoppingCart.svg`
 * (Figma 2852:70951, propuesta 8 «Íconos con más estilos», aprobada 2026-11-23).
 *
 * Por qué una ruta y no la librería de React: la tienda solo descarga los íconos que usa (uno o
 * dos KB cada uno, cacheados un año), sin sumar los ~1.500 componentes al JavaScript de cada
 * página. El editor del ERP puede pedir cualquiera en vivo y el `<use>` lo pinta igual.
 *
 * El `.svg` del final hace que el middleware no corra (su `matcher` excluye las imágenes): no
 * hay organización que resolver, el dibujo es el mismo para todas las tiendas.
 * Los archivos salen de `@phosphor-icons/core` (MIT); `next.config.js` los incluye en la función.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { archivoPhosphor, simboloDesdeSvg } from '@/lib/website/iconos/simboloPhosphor'

export const runtime = 'nodejs'

const CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable'

export async function GET(_req: Request, { params }: { params: { peso: string; nombre: string } }) {
  const pedido = archivoPhosphor(params.peso, params.nombre)
  if (!pedido) return new NextResponse(null, { status: 404 })
  try {
    const ruta = join(process.cwd(), 'node_modules', '@phosphor-icons', 'core', 'assets', pedido.peso, pedido.archivo)
    const simbolo = simboloDesdeSvg(await readFile(ruta, 'utf8'))
    if (!simbolo) return new NextResponse(null, { status: 404 })
    return new NextResponse(simbolo, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': CACHE,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    // Nombre con buena forma pero que no existe en el paquete.
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=3600' } })
  }
}
