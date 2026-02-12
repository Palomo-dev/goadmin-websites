import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/favorites?customerId=...&organizationId=...
 * Retorna array de product IDs favoritos del cliente.
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')
  const organizationId = searchParams.get('organizationId')

  if (!customerId || !organizationId) {
    return NextResponse.json({ favorites: [] })
  }

  const { data } = await (supabase as any)
    .from('customers')
    .select('metadata')
    .eq('id', customerId)
    .eq('organization_id', Number(organizationId))
    .single()

  const favorites = (data?.metadata?.favorites || []) as number[]
  return NextResponse.json({ favorites })
}

/**
 * POST /api/favorites
 * Body: { customerId, organizationId, productId, action: 'add' | 'remove' }
 * Toggle un producto como favorito.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const { customerId, organizationId, productId, action } = await request.json()

    if (!customerId || !organizationId || !productId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    // Obtener metadata actual
    const { data: customer } = await (supabase as any)
      .from('customers')
      .select('metadata')
      .eq('id', customerId)
      .eq('organization_id', Number(organizationId))
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const metadata = customer.metadata || {}
    let favorites: number[] = metadata.favorites || []

    if (action === 'remove') {
      favorites = favorites.filter((id: number) => id !== productId)
    } else {
      // add (toggle: si ya existe, no duplicar)
      if (!favorites.includes(productId)) {
        favorites.push(productId)
      }
    }

    // Actualizar metadata
    const { error: updateError } = await (supabase as any)
      .from('customers')
      .update({ metadata: { ...metadata, favorites } })
      .eq('id', customerId)
      .eq('organization_id', Number(organizationId))

    if (updateError) {
      console.error('[Favorites] Error actualizando:', updateError)
      return NextResponse.json({ error: 'Error al actualizar favoritos' }, { status: 500 })
    }

    return NextResponse.json({ favorites, action })
  } catch (error) {
    console.error('[Favorites] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
