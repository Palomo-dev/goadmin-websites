/**
 * Base en memoria para `verify-uso-pasarela.mjs`: reemplaza `@/lib/supabase/server`. Lee
 * `globalThis.__bdUso` = { metodos: [...filas de organization_payment_methods], conexiones: [],
 * sinColumnaUso: boolean }. Solo lo que usan `getWebsitePaymentMethods` y
 * `leerCondicionesContraentrega`: select, eq, in, order, limit, maybeSingle.
 */
function consulta(tabla) {
  const filtros = []
  let columnas = ''
  const q = {
    select(c) { columnas = String(c); return q },
    eq(col, v) { filtros.push((f) => f[col] === v); return q },
    in(col, vs) { if (!col.includes('.')) filtros.push((f) => vs.includes(f[col])); return q },
    order() { return q },
    limit() { return q },
    async maybeSingle() { const r = await resultado(); return { data: r.data?.[0] ?? null, error: r.error } },
    then(ok, mal) { return resultado().then(ok, mal) },
  }
  async function resultado() {
    const bd = globalThis.__bdUso
    if (tabla === 'organization_payment_methods') {
      if (bd.sinColumnaUso && columnas.includes('website_usage')) {
        return { data: null, error: { code: '42703', message: 'column organization_payment_methods.website_usage does not exist' } }
      }
      const filas = bd.metodos.filter((f) => filtros.every((p) => p(f)))
      return { data: filas.map((f) => (bd.sinColumnaUso ? (({ website_usage, ...resto }) => resto)(f) : f)), error: null }
    }
    if (tabla === 'integration_connections') return { data: bd.conexiones ?? [], error: null }
    return { data: [], error: null }
  }
  return q
}

const cliente = { from: consulta }
export const createAdminClient = () => cliente
export const createPublicClient = () => cliente
export const createServerSupabaseClient = () => cliente
