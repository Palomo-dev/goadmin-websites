import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/estimate-time?organizationId=...&branchId=...
 *
 * Calcula el tiempo estimado de preparación basado en:
 * 1. Últimos 50 kitchen_tickets completados de la branch
 * 2. Tiempo real = updated_at(status='completed') - created_at
 * 3. Filtra outliers (> 2 desviaciones estándar)
 * 4. Promedio = media de tiempos filtrados
 * 5. Factor_carga = tickets_activos_ahora / capacidad_promedio
 * 6. Estimación = promedio × (1 + factor_carga × 0.3)
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')
  const branchId = searchParams.get('branchId')

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requerido' }, { status: 400 })
  }

  try {
    // 1. Obtener últimos 50 tickets completados
    let completedQuery = (supabase as any)
      .from('kitchen_tickets')
      .select('id, created_at, updated_at, estimated_time')
      .eq('organization_id', Number(organizationId))
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(50)

    if (branchId) {
      completedQuery = completedQuery.eq('branch_id', Number(branchId))
    }

    const { data: completedTickets } = await completedQuery

    if (!completedTickets || completedTickets.length === 0) {
      // Sin datos históricos, retornar estimado por defecto
      return NextResponse.json({
        estimatedMinutes: 15,
        source: 'default',
        sampleSize: 0,
        activeTickets: 0,
      })
    }

    // 2. Calcular tiempos reales en minutos
    const times: number[] = completedTickets
      .map((t: any) => {
        const created = new Date(t.created_at).getTime()
        const updated = new Date(t.updated_at).getTime()
        return (updated - created) / 60000 // minutos
      })
      .filter((mins: number) => mins > 0 && mins < 180) // descartar negativos y > 3h

    if (times.length === 0) {
      return NextResponse.json({
        estimatedMinutes: 15,
        source: 'default',
        sampleSize: 0,
        activeTickets: 0,
      })
    }

    // 3. Filtrar outliers (> 2 desviaciones estándar)
    const mean = times.reduce((a: number, b: number) => a + b, 0) / times.length
    const stdDev = Math.sqrt(times.reduce((sum: number, t: number) => sum + Math.pow(t - mean, 2), 0) / times.length)
    const filteredTimes = times.filter((t: number) => Math.abs(t - mean) <= 2 * stdDev)

    // 4. Promedio filtrado
    const avgMinutes = filteredTimes.length > 0
      ? filteredTimes.reduce((a: number, b: number) => a + b, 0) / filteredTimes.length
      : mean

    // 5. Factor de carga: tickets activos ahora
    let activeQuery = (supabase as any)
      .from('kitchen_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', Number(organizationId))
      .in('status', ['pending', 'in_progress', 'preparing'])

    if (branchId) {
      activeQuery = activeQuery.eq('branch_id', Number(branchId))
    }

    const { count: activeCount } = await activeQuery
    const activeTickets = activeCount || 0

    // Capacidad promedio: tickets que se procesaron en paralelo (estimamos 3-5 como baseline)
    const baselineCapacity = Math.max(3, Math.round(completedTickets.length / 10))
    const loadFactor = activeTickets / baselineCapacity

    // 6. Estimación final
    const estimatedMinutes = Math.round(avgMinutes * (1 + loadFactor * 0.3))

    return NextResponse.json({
      estimatedMinutes: Math.max(5, Math.min(estimatedMinutes, 120)), // entre 5 y 120 min
      avgMinutes: Math.round(avgMinutes),
      source: 'calculated',
      sampleSize: filteredTimes.length,
      activeTickets,
      loadFactor: Math.round(loadFactor * 100) / 100,
    })
  } catch (error: any) {
    console.error('[EstimateTime] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
