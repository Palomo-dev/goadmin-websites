import { getOrgContext } from '@/lib/get-org-context'
import { getMembershipPlans } from '@/lib/supabase/queries'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { MembershipPlans } from '@/components/site/sections/gym/MembershipPlans'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Membresías' }
  return { title: `Membresías | ${ctx.organization.name}` }
}

export default async function MembresiasPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, branchId } = ctx

  const plans = await getMembershipPlans(organization.id)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero minimal */}
      <section
        className="py-20 text-center text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Nuestros Planes</h1>
          <p className="text-lg opacity-90 max-w-2xl mx-auto">
            Elige el plan que mejor se adapte a tus objetivos y comienza hoy mismo
          </p>
        </div>
      </section>

      {/* Planes */}
      <MembershipPlans
        plans={plans}
        primaryColor={primaryColor}
        organizationSubdomain={organization.subdomain || ''}
        branchId={branchId}
      />

      {/* FAQ básico */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            {[
              { q: '¿Puedo cambiar de plan?', a: 'Sí, puedes cambiar tu plan en cualquier momento. El cambio se refleja al inicio del siguiente período.' },
              { q: '¿Qué pasa si quiero cancelar?', a: 'Puedes cancelar tu membresía cuando quieras. Tu acceso permanece activo hasta el final del período pagado.' },
              { q: '¿Puedo congelar mi membresía?', a: 'Si tu plan lo permite, el equipo puede congelarla: comunícate con nosotros y te ayudamos.' },
              { q: '¿Cómo accedo al gimnasio?', a: 'Al activarse tu membresía recibirás un código de acceso que puedes usar en la entrada del gimnasio.' },
            ].map((faq, idx) => (
              <details key={idx} className="bg-white rounded-lg border p-4 group">
                <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
                  {faq.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-gray-600 mt-3 text-sm">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">¿Tienes dudas?</h2>
          <p className="text-gray-600 mb-6">Contáctanos y te ayudaremos a elegir el plan ideal</p>
          <Link
            href="/contacto"
            className="inline-block px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            Contáctanos
          </Link>
        </div>
      </section>
    </div>
  )
}
