/**
 * Arnés interno de la franja en movimiento (Marquee). Solo con `PRUEBAS_INTERNAS=1`; si no, 404.
 * No consulta Supabase. Lo usa scripts/pruebas/franja-movimiento.mjs.
 *
 * Query string: `variante` (text | photos), `respetar` (1 = respect_reduced_motion: true),
 * `tamano` (sm | md | lg).
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Marquee } from '@/components/sections/restaurant/Marquee'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pruebas internas · franja', robots: { index: false, follow: false } }

const FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="280" height="200"><rect width="280" height="200" fill="#d1d5db"/></svg>')

export default function PaginaPruebaFranja({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  if (process.env.PRUEBAS_INTERNAS !== '1') notFound()
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const variante = uno(searchParams.variante) === 'photos' ? 'photos' : 'text'
  const tamano = uno(searchParams.tamano)
  const contenido: Record<string, unknown> = {
    phrases: 'Pesca del día\nLeña y carbón\nMaíz criollo\nHecho en casa',
    images: Array.from({ length: 4 }, (_, i) => ({ url: FOTO, alt: `Foto ${i + 1}` })),
    ...(tamano ? { size: tamano } : {}),
    ...(uno(searchParams.respetar) === '1' ? { respect_reduced_motion: true } : {}),
  }
  return (
    <main style={{ ['--primary-color' as string]: '#1E3A8A', ['--secondary-color' as string]: '#F59E0B' }}>
      <h1 className="p-4 text-lg">Franja</h1>
      <div data-franja="">
        <Marquee content={contenido} sectionVariant={variante} />
      </div>
      <div style={{ height: 1200 }} />
    </main>
  )
}
