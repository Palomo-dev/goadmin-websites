'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AuthCustomerClient {
  id: string
  organization_id: number
}

/**
 * Hook client-side para obtener el cliente autenticado.
 * Usa el Supabase browser client para leer la sesión actual.
 *
 * Uso:
 *   const { customer, loading } = useAuthCustomer(organizationId)
 */
export function useAuthCustomer(organizationId?: number | null) {
  const [customer, setCustomer] = useState<AuthCustomerClient | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          if (!cancelled) setLoading(false)
          return
        }

        const { data } = await supabase
          .from('customers')
          .select('id, organization_id')
          .eq('organization_id', organizationId)
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (!cancelled && data) {
          setCustomer(data as AuthCustomerClient)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [organizationId])

  return { customer, loading }
}
