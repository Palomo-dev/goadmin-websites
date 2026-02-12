/**
 * Helper para obtener el cliente autenticado en páginas server-side.
 * 
 * Flujo:
 * 1. Lee cookies de sesión de Supabase Auth
 * 2. Obtiene user_id del usuario autenticado
 * 3. Busca el registro de customers vinculado a esa org + user_id
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface AuthCustomer {
  id: string
  organization_id: number
  user_id: string
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  identification_type: string | null
  identification_number: string | null
  doc_type: string | null
  doc_number: string | null
  address: string | null
  city: string | null
  avatar_url: string | null
  created_at: string | null
}

export async function getAuthCustomer(organizationId: number): Promise<AuthCustomer | null> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: customer } = await (supabase as any)
      .from('customers')
      .select('id, organization_id, user_id, email, phone, first_name, last_name, full_name, identification_type, identification_number, doc_type, doc_number, address, city, avatar_url, created_at')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    return customer as AuthCustomer | null
  } catch {
    return null
  }
}
