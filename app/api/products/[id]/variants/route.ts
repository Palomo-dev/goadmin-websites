import { NextRequest, NextResponse } from 'next/server'
import { getProductVariants } from '@/lib/supabase/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')

  if (!id || !organizationId) {
    return NextResponse.json({ variants: [] }, { status: 400 })
  }

  const variants = await getProductVariants(Number(id), Number(organizationId))

  return NextResponse.json({ variants })
}
