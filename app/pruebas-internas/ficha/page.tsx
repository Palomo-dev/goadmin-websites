/**
 * Arnés interno de la ficha de producto (verify:ficha-diff). NO es una página de la tienda.
 *
 * Responde 404 salvo que el servidor corra con `PRUEBAS_INTERNAS=1`. No consulta Supabase: los
 * datos salen de `scripts/pruebas/fixtures/ficha-<org>.json` (extraídos en solo lectura y sin
 * identidad de la organización) y los `page_settings` de `ficha-ajustes.json`.
 *
 *   /pruebas-internas/ficha?org=339&modo=fallback&ajustes=base
 *
 * Modos:
 * - `referencia`: el ProductDetailRenderer de ANTES de la fase 1 (copia congelada), sin secciones.
 * - `fallback`:   el ProductDetailRenderer actual sin secciones (pinta los bloques por defecto).
 * - `plantilla`:  el ProductDetailRenderer actual con una plantilla que trae los bloques por
 *                 defecto como secciones, pasadas por el camino V2 (esquemaPagina + paginaAPublica).
 * - `pagina`:     el JSX que hoy pinta app/productos/[id]/page.tsx sin plantilla (copia congelada).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { notFound } from 'next/navigation'
import type { OrganizationWithDetails, WebsitePageWithSections } from '@/types/database'
import { ProductDetailRenderer } from '@/components/sections/product-detail/ProductDetailRenderer'
import { CurrencyProvider } from '@/components/site/CurrencyProvider'
import { RutaSitioProvider } from '@/lib/outlet/RutaSitioContext'
import { urlPublicaStorage } from '@/lib/storage/urlPublica'
import { buildDefaultProductDetailSections } from '@/lib/defaultProductDetailSections'
import { esquemaPagina } from '@/lib/website/v2/contrato/documentoSitio'
import { paginaAPublica } from '@/lib/website/v2/vistaPublica'
import { ProductDetailRendererReferencia } from './_referencia/ProductDetailRendererReferencia'
import { FichaPaginaActual } from './_referencia/FichaPaginaActual'

export const dynamic = 'force-dynamic'

const MODOS = ['referencia', 'fallback', 'plantilla', 'pagina'] as const
type Modo = (typeof MODOS)[number]

interface FixtureFicha {
  org: number
  organization: Record<string, unknown> & { website_settings: Record<string, unknown> }
  primaryColor: string
  branchId: number | null
  product: any
  variants: any[]
  modifierGroups: any[]
  relatedProducts: any[]
  ordenAtributos: Record<string, Record<string, number>> | null
}

interface AjusteFicha {
  pageSettings: Record<string, unknown>
  /** Claves que se mezclan sobre `website_settings` del fixture (p. ej. `conversion`). */
  sitio?: Record<string, unknown>
}

function leerJson<T>(archivo: string): T | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'pruebas', 'fixtures', archivo), 'utf8')) as T
  } catch {
    return null
  }
}

/** La plantilla con los bloques por defecto, como la serviría un documento V2 publicado. */
function plantillaV2(pageSettings: Record<string, unknown>, organizationId: number): WebsitePageWithSections {
  const pagina = esquemaPagina.parse({
    id: 'plantilla-product-detail',
    slug: 'plantillas/product-detail',
    tipo: 'product_detail',
    titulo: 'Ficha de producto',
    publicada: true,
    secciones: buildDefaultProductDetailSections(pageSettings).map((s) => ({
      id: s.id,
      tipo: s.section_type,
      variante: s.section_variant,
      version: 1,
      contenido: s.content as Record<string, unknown>,
      diseno: {},
      // Oculto en el layout de antes = oculto en los tres dispositivos (paginaAPublica no lo emite).
      visibilidad: s.is_visible ? { movil: true, escritorio: true } : { movil: false, escritorio: false, tableta: false },
    })),
  })
  const publica = paginaAPublica(pagina, { organizationId, branchId: null })
  // El contrato V2 no tiene destino para `page_settings` (vistaPublica lo deja en null): el arnés
  // lo repone para comparar el mismo layout. Pendiente de la fase 3.
  return { ...publica, page_settings: pageSettings as WebsitePageWithSections['page_settings'] }
}

export default async function PruebaFicha({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  if (process.env.PRUEBAS_INTERNAS !== '1') notFound()

  const params = await searchParams
  const org = String(params.org ?? '')
  const modo = String(params.modo ?? '') as Modo
  const nombreAjuste = String(params.ajustes ?? 'base')
  if (!/^\d+$/.test(org) || !MODOS.includes(modo)) notFound()

  const fixture = leerJson<FixtureFicha>(`ficha-${org}.json`)
  const ajustes = leerJson<Record<string, AjusteFicha>>('ficha-ajustes.json')
  const ajuste = ajustes?.[nombreAjuste]
  if (!fixture || !ajuste) notFound()

  const organization = {
    ...fixture.organization,
    website_settings: { ...fixture.organization.website_settings, ...(ajuste.sitio ?? {}) },
  } as unknown as OrganizationWithDetails
  const { product, variants, modifierGroups, relatedProducts, primaryColor, branchId } = fixture
  const ordenAtributos = fixture.ordenAtributos
  const pageSettings = ajuste.pageSettings

  // Igual que app/productos/[id]/page.tsx
  const price = product.product_prices?.[0]
  const comparePrice = price?.compare_price ? Number(price.compare_price) : null
  const isParent = product.is_parent === true
  const esRestaurante = organization.type_id === 1
  const puedePedir = !esRestaurante || (organization.website_settings as { enable_online_ordering?: boolean } | null)?.enable_online_ordering === true
  const restaurante = esRestaurante ? { textoAgotado: null } : null
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://taqjemqjtumhwptchcxk.supabase.co'
  const sortedImages = [...(product.product_images || [])]
    .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order)
  const allImageUrls: string[] = sortedImages
    .map((img: any) => {
      const path = img.storage_path || img.shared_images?.storage_path
      return path ? urlPublicaStorage(path, 'product-images', SUPABASE_URL) : null
    })
    .filter(Boolean) as string[]
  const imageUrl = allImageUrls[0] || null

  const sinSecciones = {
    id: 'plantilla-product-detail',
    page_settings: pageSettings,
    website_page_sections: [],
  } as unknown as WebsitePageWithSections

  const comunes = {
    organization, primaryColor, product, variants, modifierGroups, relatedProducts,
    imageUrls: allImageUrls, imageUrl, price, comparePrice, isParent, branchId,
    restaurante, puedePedir, prefijoSede: '', ordenAtributos,
  }

  let contenido: React.ReactNode
  if (modo === 'referencia') {
    contenido = <ProductDetailRendererReferencia {...comunes} templatePage={sinSecciones} />
  } else if (modo === 'fallback') {
    contenido = <ProductDetailRenderer {...comunes} templatePage={sinSecciones} />
  } else if (modo === 'plantilla') {
    contenido = <ProductDetailRenderer {...comunes} templatePage={plantillaV2(pageSettings, fixture.org)} />
  } else {
    contenido = (
      <FichaPaginaActual
        organization={organization} primaryColor={primaryColor} product={product} variants={variants}
        modifierGroups={modifierGroups} relatedProducts={relatedProducts} allImageUrls={allImageUrls}
        imageUrl={imageUrl} price={price} comparePrice={comparePrice} isParent={isParent} branchId={branchId}
        restaurante={restaurante} puedePedir={puedePedir} ordenAtributos={ordenAtributos}
        esRestaurante={esRestaurante} prefijo=""
      />
    )
  }

  const ws = organization.website_settings as { show_currency_code?: boolean; currency_position?: 'left' | 'right' } | null
  return (
    <CurrencyProvider showCurrencyCode={ws?.show_currency_code === true} currencyPosition={ws?.currency_position === 'right' ? 'right' : 'left'}>
      <RutaSitioProvider prefijo="">
        <main id="ficha-raiz" data-modo={modo}>{contenido}</main>
      </RutaSitioProvider>
    </CurrencyProvider>
  )
}
