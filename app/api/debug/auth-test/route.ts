import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET() {
  const results: Record<string, any> = {
    env: {
      url_present: !!SUPABASE_URL,
      key_present: !!SUPABASE_ANON_KEY,
      url_length: SUPABASE_URL?.length || 0,
      key_length: SUPABASE_ANON_KEY?.length || 0,
      url: SUPABASE_URL?.replace(/https:\/\/(.{8}).*/, 'https://$1...') || null,
    },
    tests: {}
  }

  // Test 1: Librería @supabase/supabase-js
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test-nonexistent@test.com',
      password: 'test123'
    })
    results.tests.library = {
      success: !error,
      error: error?.message || null,
      error_name: error?.name || null,
      status: error?.status || null,
      has_user: !!data?.user,
      has_session: !!data?.session
    }
  } catch (e: any) {
    results.tests.library = {
      success: false,
      exception: e.message,
      stack: e.stack?.split('\n').slice(0, 3)
    }
  }

  // Test 2: Fetch directo al endpoint REST (datos)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    })
    results.tests.rest_api = {
      status: res.status,
      ok: res.ok,
      statusText: res.statusText
    }
  } catch (e: any) {
    results.tests.rest_api = {
      exception: e.message
    }
  }

  // Test 3: Fetch directo al endpoint de Auth
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test-nonexistent@test.com',
        password: 'test123'
      })
    })
    const body = await res.json().catch(() => ({}))
    results.tests.auth_api = {
      status: res.status,
      ok: res.ok,
      statusText: res.statusText,
      body: body
    }
  } catch (e: any) {
    results.tests.auth_api = {
      exception: e.message
    }
  }

  return NextResponse.json(results)
}
