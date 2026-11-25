'use client'

/**
 * `membership_plans` · `pricing_table` — «Planes de membresía» (Figma «16 Sitio web», sección
 * 3279-100508; tarjeta 3279-100711; estados 3283-100941).
 *
 * Los planes son los ACTIVOS de Membresías › Planes con el precio vigente de su producto
 * (`getMembershipPlans`, cargados por app/[[...slug]]/page.tsx en `data.membershipPlans`). La
 * sección solo decide el orden, cuáles se ven, cuál es «Popular» y los textos
 * (lib/website/v2/contrato/paginaMembresias.ts, la misma regla que el editor del ERP).
 *
 * Botón de cada plan:
 * - Se vende en línea: «Comprar plan» agrega el producto del plan al carrito y abre el checkout
 *   (pedido web normal; el ERP activa la membresía al confirmarse el pago). Igual que antes.
 * - No se vende en línea: «Consultar por WhatsApp» con el mensaje listo; sin WhatsApp (o si la
 *   tienda eligió Contacto), «Consultar» lleva a Contacto.
 * - Producto pausado: «No disponible por ahora», botón apagado y enlace para preguntar.
 *
 * Sin planes activos la tienda no pinta nada; en el lienzo del editor, planes de muestra
 * marcados «Ejemplo» (nunca se publican ni se compran).
 */

import { useRouter } from 'next/navigation'
import { Check, Clock, MessageCircle, ShieldCheck, ShoppingBag, Star } from 'lucide-react'
import Link from '@/components/site/Enlace'
import { PrecioAnterior } from '@/components/site/PrecioAnterior'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'
import { getCartKey } from '@/lib/utils'
import { formatDuracionPlan, formatPeriodo } from '@/lib/memberships/periodo'
import { mostrarPrecioAnterior, precioAnteriorValido } from '@/lib/products/precioAnterior'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { whatsappDe } from '@/lib/website/menuInferior'
import { datosContactoDe, whatsappDeTienda } from '@/lib/website/v2/contrato/paginaContacto'
import {
  ID_POPULAR_EJEMPLO,
  PLANES_EJEMPLO,
  leerAjustesPlanes,
  mensajeWhatsappPlan,
  planesVisibles,
  popularVisible,
  type EstadoVentaPlan,
} from '@/lib/website/v2/contrato/paginaMembresias'

/** Lo que la tarjeta necesita de un plan (`MembershipPlanPublic` o un plan de muestra). */
export interface PlanTarjeta {
  id: number
  name: string
  description?: string | null
  duration_days: number
  duration_unit?: string | null
  duration_value?: number | null
  frequency?: string | null
  access_rules?: { features?: unknown } | Record<string, unknown> | null
  product_id?: number | null
  price: number | null
  compare_price?: number | null
  estado?: EstadoVentaPlan
}

interface MembershipPlansPricingProps {
  content: Record<string, unknown>
  primaryColor?: string
  organization?: {
    subdomain?: string | null
    phone?: unknown
    email?: unknown
    address?: unknown
    city?: unknown
    website_settings?: Record<string, unknown> | null
  } | null
  data?: { membershipPlans?: PlanTarjeta[]; branchId?: number | null }
}

/** Estado del plan; las entradas de caché anteriores al campo `estado` se deducen como antes. */
export function estadoDePlan(plan: PlanTarjeta): EstadoVentaPlan {
  if (plan.estado === 'en_linea' || plan.estado === 'consulta' || plan.estado === 'pausado') return plan.estado
  return plan.product_id && plan.price !== null ? 'en_linea' : 'consulta'
}

function beneficios(plan: PlanTarjeta): string[] {
  const f = (plan.access_rules as { features?: unknown } | null | undefined)?.features
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []
}

function pesos(n: number): string {
  return `$${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

function txt(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** ¿Hay planes reales que pintar? Sin ellos, la tienda no pinta la sección (SectionRenderer). */
export function hayPlanesMembresia(data: unknown): boolean {
  const planes = (data as { membershipPlans?: unknown } | null | undefined)?.membershipPlans
  return Array.isArray(planes) && planes.length > 0
}

/** Pinta `children` solo en el lienzo del editor (?preview=1). En la tienda, nada. */
export function SoloEnVistaPrevia({ children }: { children: React.ReactNode }) {
  const enEditor = useIsPreviewMode()
  return enEditor ? <>{children}</> : null
}

export function MembershipPlansPricing({ content, primaryColor = '#3B82F6', organization, data }: MembershipPlansPricingProps) {
  const enEditor = useIsPreviewMode()
  const { ruta } = useRutaSitio()
  const router = useRouter()
  const ajustes = leerAjustesPlanes(content)
  const reales = data?.membershipPlans ?? []
  const esMuestra = reales.length === 0
  // Sin planes reales: solo el lienzo del editor, y solo si la tienda no apagó la muestra.
  if (esMuestra && !(enEditor && ajustes.verEjemplo)) return null

  const todos: PlanTarjeta[] = esMuestra ? PLANES_EJEMPLO.map((p) => ({ ...p, product_id: null })) : reales
  const visibles = planesVisibles(todos, ajustes)
  const popular = esMuestra
    ? popularVisible(visibles, { popular: ajustes.popular ?? ID_POPULAR_EJEMPLO })
    : popularVisible(visibles, ajustes)
  const unSolo = visibles.length === 1
  const titulo = txt(content.title)
  const subtitulo = txt(content.subtitle)
  // «Mostrar descripción» del inspector. Ausente = se muestra, como antes de leerlo.
  const conDescripcion = content.show_description !== false
  // «Precio anterior»: el `compare_price` del precio vigente del producto. Ausente = sin él, como antes.
  const conAnterior = mostrarPrecioAnterior(content)

  const ajustesSitio = organization?.website_settings ?? null
  const numeroWhatsapp = ajustes.sinVenta === 'whatsapp'
    ? whatsappDeTienda(datosContactoDe(organization ?? null, ajustesSitio as never))?.numero ?? null
    : null
  const enlaceWhatsapp = (plan: PlanTarjeta) => (numeroWhatsapp ? whatsappDe(numeroWhatsapp, mensajeWhatsappPlan(ajustes.mensaje, plan.name)) : null)
  const hayVentaEnLinea = visibles.some((p) => estadoDePlan(p) === 'en_linea')

  /**
   * La membresía se compra como su producto: se agrega al carrito y sigue el checkout normal
   * (pedido web). Al confirmarse el pago, el ERP activa la membresía con
   * `fn_membresias_activar_venta`. Misma forma de línea que AddToCartButton; CartEventTracker
   * dispara el pixel. Una membresía por plan: la cantidad N compra N períodos seguidos.
   */
  const comprar = (plan: PlanTarjeta) => {
    if (esMuestra || !plan.product_id || plan.price === null) return
    try {
      const subdomain = organization?.subdomain || window.location.hostname.split('.')[0]
      const cartKey = getCartKey(subdomain, data?.branchId ?? null)
      const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
      const idx = cart.findIndex((item: { id?: unknown }) => item.id === plan.product_id)
      if (idx < 0) {
        cart.push({ id: plan.product_id, name: plan.name, price: Number(plan.price), quantity: 1 })
        localStorage.setItem(cartKey, JSON.stringify(cart))
        window.dispatchEvent(new CustomEvent('cart-updated'))
      }
    } catch (err) {
      console.error('Error agregando la membresía al carrito:', err)
      return
    }
    router.push(ruta('/checkout'))
  }

  const columnas = unSolo
    ? 'max-w-md'
    : visibles.length === 2
      ? 'max-w-3xl md:grid-cols-2'
      : 'max-w-6xl md:grid-cols-2 lg:grid-cols-3'

  return (
    <div data-seccion-membresias="" data-muestra={esMuestra ? '' : undefined}>
      {esMuestra && (
        <div className="mx-auto mb-8 flex max-w-3xl items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
          <Star aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Ejemplo · no visible para tus clientes</p>
            <p className="text-xs">Planes de muestra para diseñar la página. Al crear tu primer plan en Membresías › Planes, aquí aparecen los reales.</p>
          </div>
        </div>
      )}
      {titulo && <h2 className="titulo-legado mb-3 text-center text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">{titulo}</h2>}
      {subtitulo && <p className="mb-10 text-center text-gray-600 dark:text-gray-300">{subtitulo}</p>}

      <div className={`mx-auto grid grid-cols-1 gap-6 ${columnas}`}>
        {visibles.map((plan) => {
          const estado = estadoDePlan(plan)
          const pausado = estado === 'pausado'
          const esPopular = plan.id === popular
          const destacada = (esPopular || unSolo) && !pausado
          const lista = beneficios(plan)
          const anterior = conAnterior && plan.price !== null ? precioAnteriorValido(plan.compare_price, plan.price) : null
          const whatsapp = enlaceWhatsapp(plan)
          return (
            <article
              key={plan.id}
              data-plan={plan.id}
              data-estado={estado}
              data-popular={esPopular ? '' : undefined}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 dark:bg-gray-800/50 md:p-7 ${destacada ? 'border-2 shadow-lg' : 'border-gray-200 dark:border-gray-700'} ${esPopular ? 'order-first md:order-none' : ''}`}
              style={destacada ? { borderColor: primaryColor } : undefined}
            >
              {pausado && (
                <span className="mb-2 inline-flex w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                  No disponible por ahora
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                <div className="flex shrink-0 items-center gap-1">
                  {esMuestra && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Ejemplo</span>
                  )}
                  {esPopular && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: primaryColor }}>
                      <Star aria-hidden="true" className="h-3 w-3" />
                      Popular
                    </span>
                  )}
                </div>
              </div>
              {conDescripcion && plan.description && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>}

              <div className="mt-4">
                {plan.price !== null ? (
                  <>
                    {anterior !== null && <PrecioAnterior className="block text-sm">{pesos(anterior)}</PrecioAnterior>}
                    <span className={`text-4xl font-black md:text-5xl ${pausado ? 'text-gray-400' : ''}`} style={pausado ? undefined : { color: primaryColor }}>
                      {pesos(plan.price)}
                    </span>
                    <span className="ml-1 text-gray-500 dark:text-gray-400">{formatPeriodo(plan)}</span>
                  </>
                ) : (
                  <>
                    <span className="block text-2xl font-bold text-gray-700 dark:text-gray-200">Precio a consultar</span>
                    {!pausado && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{whatsapp ? 'Te contamos por WhatsApp' : 'Escríbenos y te contamos'}</span>
                    )}
                  </>
                )}
              </div>

              {ajustes.mostrarDuracion && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  Duración: {formatDuracionPlan(plan)}
                </p>
              )}

              {lista.length > 0 && (
                <ul className="mt-5 space-y-2.5 border-t border-gray-100 pt-5 dark:border-gray-700">
                  {lista.map((b, i) => (
                    <li key={`${i}-${b}`} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: pausado ? '#9CA3AF' : primaryColor }} />
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto pt-6">
                {estado === 'en_linea' ? (
                  <button
                    type="button"
                    onClick={() => comprar(plan)}
                    aria-disabled={esMuestra || undefined}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 px-5 py-3 font-semibold transition-opacity hover:opacity-90"
                    style={destacada
                      ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' }
                      : { borderColor: primaryColor, color: primaryColor, backgroundColor: 'transparent' }}
                  >
                    {destacada && <ShoppingBag aria-hidden="true" className="h-4 w-4" />}
                    {ajustes.boton}
                  </button>
                ) : estado === 'consulta' ? (
                  whatsapp ? (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <MessageCircle aria-hidden="true" className="h-4 w-4" />
                      Consultar por WhatsApp
                    </a>
                  ) : (
                    <Link
                      href="/contacto"
                      className="flex w-full items-center justify-center rounded-lg border-2 px-5 py-3 font-semibold transition-opacity hover:opacity-90"
                      style={{ borderColor: primaryColor, color: primaryColor }}
                    >
                      Consultar
                    </Link>
                  )
                ) : (
                  <>
                    <button type="button" disabled className="w-full cursor-not-allowed rounded-lg bg-gray-100 px-5 py-3 font-semibold text-gray-400 dark:bg-gray-700">
                      No disponible
                    </button>
                    {whatsapp ? (
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-sm font-medium text-green-700 hover:underline">
                        Preguntar cuándo vuelve por WhatsApp
                      </a>
                    ) : (
                      <Link href="/contacto" className="mt-3 block text-center text-sm font-medium hover:underline" style={{ color: primaryColor }}>
                        Preguntar cuándo vuelve
                      </Link>
                    )}
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {ajustes.mostrarNotaPago && hayVentaEnLinea && (
        <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-600 dark:text-gray-400">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-green-600" />
          Pagas en línea como cualquier compra. La membresía se activa al confirmarse el pago y la ves en Mi cuenta › Membresía.
        </p>
      )}
    </div>
  )
}
