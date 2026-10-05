import { NextRequest, NextResponse } from 'next/server'
import { getProductVariants } from '@/lib/supabase/queries'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { organizacionDePeticion, sedeDeOrganizacion } from '@/lib/api/organizacion-peticion'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const productId = Number(id)

  if (!id || !Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ variants: [] }, { status: 400 })
  }

  // La organización sale del host; el `organizationId` del query solo se compara (403).
  const org = await organizacionDePeticion(searchParams.get('organizationId'), 'Variants API')
  if (!org.ok) return org.respuesta

  // Con sede, las variantes aplican su carta (precio web, oculto, agotado), igual que la ficha.
  const sede = await sedeDeOrganizacion(
    createAdminClient() || createPublicClient(),
    org.organizationId,
    searchParams.get('branchId'),
  )
  if (sede === 'invalida') {
    return NextResponse.json({ variants: [] }, { status: 400 })
  }

  const variants = await getProductVariants(productId, org.organizationId, sede)

  return NextResponse.json({ variants })
}
