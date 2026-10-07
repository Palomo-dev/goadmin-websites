import Link from 'next/link'
import type { MembershipPlanPublic } from '@/lib/supabase/queries'
import { formatPeriodo } from '@/lib/memberships/periodo'

interface MembershipPlansPricingProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    show_description?: boolean
  }
  primaryColor?: string
  /**
   * `data.membershipPlans`: los planes activos con el precio vigente de su
   * producto (`getMembershipPlans`, el mismo de /membresias), cargados por
   * app/[[...slug]]/page.tsx. Antes leía `data.products`, que es el catálogo
   * de productos y ni siquiera se cargaba con esta sección: salía vacía.
   */
  data?: { membershipPlans?: MembershipPlanPublic[] }
}

export function MembershipPlansPricing({ content, primaryColor, data }: MembershipPlansPricingProps) {
  const plans = data?.membershipPlans || []
  // La compra es el producto del plan en un pedido web: se hace en /membresias.
  const ctaUrl = content.cta_url || '/membresias'
  // «Mostrar descripción» del inspector. Ausente = se muestra, como antes de leerlo.
  const showDescription = content.show_description !== false

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={plan.id || i}
              className={`rounded-2xl border-2 p-6 text-center transition-shadow hover:shadow-lg dark:bg-gray-800/50 dark:border-gray-600 ${i === 1 ? 'scale-105 shadow-lg' : ''}`}
              style={{ borderColor: i === 1 ? primaryColor : undefined }}
            >
              {i === 1 && (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3" style={{ backgroundColor: primaryColor }}>
                  POPULAR
                </span>
              )}
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{plan.name}</h3>
              {showDescription && plan.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{plan.description}</p>}
              <div className="mb-6">
                {plan.price !== null ? (
                  <>
                    <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                      ${Number(plan.price).toLocaleString('es-CO')}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">{formatPeriodo(plan)}</span>
                  </>
                ) : (
                  <span className="text-lg font-medium text-gray-500 dark:text-gray-400">Consulta el precio en recepción</span>
                )}
              </div>
              <Link
                href={ctaUrl}
                className="block w-full px-6 py-3 rounded-lg font-medium transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: i === 1 ? primaryColor : 'transparent',
                  color: i === 1 ? 'white' : primaryColor,
                  border: `2px solid ${primaryColor}`,
                }}
              >
                {content.cta_text || 'Inscribirme'}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">💪</p>
          <p>Planes de membresía próximamente</p>
        </div>
      )}
    </div>
  )
}
