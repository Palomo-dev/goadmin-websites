import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params
  const supabase = getSupabase()
  
  const { data, error } = await (supabase as any)
    .from('space_types')
    .select('*')
    .eq('organization_id', parseInt(orgId))
    .eq('is_active', true)
    .order('name')
  
  if (error) {
    console.error('Error fetching space types:', error)
    return NextResponse.json({ data: [] })
  }
  
  return NextResponse.json({ data: data || [] })
}
