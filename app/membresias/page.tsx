import type { Metadata } from 'next'
import CatchAllPage, { generateMetadata as metadataPagina } from '@/app/[[...slug]]/page'
import { getOrgContext } from '@/lib/get-org-context'
import { getPlanesDeSeccion } from '@/lib/website/datosSecciones'
import { SLUG_PAGINA_MEMBRESIAS, tieneMembresias } from '@/lib/website/v2/contrato/paginaMembresias'

/**
 * /membresias (Figma «16 Sitio web», sección 3279-100508).
 *
 * Es la página «Membresías» del editor —o su plantilla si la tienda no la armó—, pintada por la
 * misma página que todas las demás (app/[[...slug]]/page.tsx): con la cabecera, el pie y el estilo
 * de la tienda. Antes esta ruta fija tapaba la página del editor, no usaba el diseño de la tienda y
 * traía planes y preguntas de gimnasio escritos en el código.
 *
 * Sin planes de membresía activos responde 404 con la marca de la tienda (./not-found.tsx).
 */
export const dynamic = 'force-dynamic'

type Busqueda = Record<string, string | string[] | undefined>
const PARAMS = { slug: [SLUG_PAGINA_MEMBRESIAS] }

export async function generateMetadata({ searchParams }: { searchParams: Promise<Busqueda> }): Promise<Metadata> {
  // Mismo argumento que la página comodín: una sola lectura del contexto (react.cache).
  const ctx = await getOrgContext(SLUG_PAGINA_MEMBRESIAS)
  const enEditor = (await searchParams)?.preview === '1'
  if (ctx && !enEditor && !tieneMembresias(await getPlanesDeSeccion(ctx.organization.id))) {
    return {
      title: `Página no disponible | ${ctx.organization.name}`,
      robots: { index: false, follow: true },
    }
  }
  return metadataPagina({ params: Promise.resolve(PARAMS) })
}

export default async function MembresiasPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  return CatchAllPage({ params: Promise.resolve(PARAMS), searchParams })
}
