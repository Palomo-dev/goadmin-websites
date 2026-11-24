/**
 * Arnés interno de `components/site/Enlace` (los enlaces de la tienda no precargan su destino).
 * Solo con `PRUEBAS_INTERNAS=1`; si no, 404. No consulta Supabase. Lo usa
 * scripts/pruebas/enlaces-precarga.mjs.
 *
 * Cuatro enlaces a la vista, cada uno a una ruta distinta para que la prueba sepa cuál precargó:
 * - Enlace a una página cualquiera: NO precarga.
 * - Enlace al checkout (la única ruta con `loading.tsx`): precarga.
 * - Enlace con `prefetch` puesto a mano: precarga (se respeta).
 * - `next/link` directo, el testigo: precarga. Demuestra que la prueba detecta precargas; por eso
 *   este archivo está en la lista de permitidos de scripts/verify-enlaces.mjs.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NextLink from 'next/link'
import Enlace from '@/components/site/Enlace'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pruebas internas · enlaces', robots: { index: false, follow: false } }

export default function PaginaPruebaEnlaces() {
  if (process.env.PRUEBAS_INTERNAS !== '1') notFound()
  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="text-lg">Enlaces</h1>
      <Enlace href="/productos" data-enlace="normal">Productos (sin precarga)</Enlace>
      <Enlace href="/checkout" data-enlace="checkout">Checkout (con precarga)</Enlace>
      <Enlace href="/contacto" prefetch data-enlace="a-mano">Contacto (precarga pedida a mano)</Enlace>
      <NextLink href="/ofertas" data-enlace="testigo">Ofertas (next/link directo: testigo)</NextLink>
    </main>
  )
}
