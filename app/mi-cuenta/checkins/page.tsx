import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerCheckins } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Check-ins' }
  return { title: `Mis Check-ins | ${ctx.organization.name}` }
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1)
  return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

export default async function CheckinsPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const checkins = customer ? await getCustomerCheckins(customer.id, organization.id, 100) : []

  // Estadísticas
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthCount = checkins.filter((ci: any) => getMonthKey(ci.checked_in_at) === thisMonth).length

  // Últimos 6 meses para gráfica
  const monthCounts: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthCounts[key] = 0
  }
  for (const ci of checkins) {
    const key = getMonthKey(ci.checked_in_at)
    if (key in monthCounts) monthCounts[key]++
  }
  const maxCount = Math.max(...Object.values(monthCounts), 1)

  // Agrupar por mes para listado
  const grouped: Record<string, any[]> = {}
  for (const ci of checkins) {
    const key = getMonthKey(ci.checked_in_at)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ci)
  }
  const groupedEntries = Object.entries(grouped)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Check-ins</h1>
        <p className="text-gray-500">Historial de accesos al gimnasio</p>
      </div>

      {checkins.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">✅</p>
          <h3 className="font-semibold text-lg mb-1">Sin check-ins registrados</h3>
          <p className="text-gray-500">Tu historial de accesos aparecerá aquí</p>
        </div>
      ) : (
        <>
          {/* Resumen rápido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-3xl font-bold" style={{ color: primaryColor }}>{thisMonthCount}</p>
              <p className="text-xs text-gray-500 mt-1">Este mes</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-3xl font-bold" style={{ color: primaryColor }}>{checkins.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total</p>
            </div>
          </div>

          {/* Gráfica de barras últimos 6 meses */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold mb-4 text-gray-700">Asistencia mensual</h2>
            <div className="flex items-end gap-2 h-28">
              {Object.entries(monthCounts).map(([key, count]) => {
                const heightPct = (count / maxCount) * 100
                const d = new Date(Number(key.split('-')[0]), Number(key.split('-')[1]) - 1)
                const label = d.toLocaleDateString('es-CO', { month: 'short' })
                return (
                  <div key={key} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-700">{count || ''}</span>
                    <div className="w-full rounded-t" style={{ height: `${Math.max(heightPct, 4)}%`, backgroundColor: primaryColor, opacity: key === thisMonth ? 1 : 0.5 }} />
                    <span className="text-[10px] text-gray-400 capitalize">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Listado agrupado por mes */}
          {groupedEntries.map(([monthKey, items]) => (
            <div key={monthKey}>
              <h2 className="text-sm font-semibold text-gray-600 mb-2 capitalize">{getMonthLabel(monthKey)} ({items.length})</h2>
              <div className="bg-white rounded-xl border divide-y">
                {items.map((ci: any) => (
                  <div key={ci.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">✅</span>
                      <div>
                        <p className="font-medium text-sm">
                          {new Date(ci.checked_in_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(ci.checked_in_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          {ci.checked_out_at && ` → ${new Date(ci.checked_out_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                    </div>
                    {ci.branch_name && <span className="text-xs text-gray-400">{ci.branch_name}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
