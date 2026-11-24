import { Metadata } from 'next'
import Link from '@/components/site/Enlace'
import { Package, Search } from 'lucide-react'
import { getOrgContext } from '@/lib/get-org-context'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { getCuentaCliente, pedidosDeCuenta, type PedidoCuenta } from '@/lib/cuenta/cuentaCliente'
import { GRUPOS_PEDIDO, coincideBusqueda, leerGrupo } from '@/lib/cuenta/reglasCuenta'
import { TarjetaPedido, avanceDe } from '@/components/site/cuenta/PedidosCuenta'
import { diaPedido, horaPedido } from '@/lib/restaurant/ventanaPedido'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis pedidos' }
  return { title: `Mis pedidos | ${ctx.organization.name}`, robots: { index: false, follow: false } }
}

/** Línea de al lado de las fotos (Figma E): lo que el cliente necesita saber del pedido. */
function detallePedido(p: PedidoCuenta, esRestaurante: boolean, zona: string | null): string | null {
  if (p.status === 'delivered') {
    if (!p.deliveredAt) return 'Entregado'
    const dia = diaPedido(p.deliveredAt, zona)
    const d = dia === 'Hoy' ? 'hoy' : dia === 'Mañana' ? 'mañana' : `el ${dia.toLowerCase()}`
    return `Entregado ${d} a las ${horaPedido(p.deliveredAt, zona)}`
  }
  const av = avanceDe(p, esRestaurante)
  return av.titulo
}

/**
 * Mis pedidos (Figma «16 Sitio web» E 2976:72285): En curso / Anteriores / Cancelados con su
 * conteo, buscador por número o producto, fotos y acciones según el estado. Incluye los pedidos
 * hechos sin cuenta con el correo verificado de la sesión. Últimos 12 meses; «Ver más antiguos»
 * trae todos (hasta 200). El detalle es la página del pedido rediseñada.
 */
export default async function MisPedidosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization } = ctx
  const esRestaurante = organization.type_id === 1
  const zona = ((organization as { timezone?: string | null }).timezone ?? null) as string | null

  const params = await searchParams
  const todos = params.todos === '1'
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 80) : ''
  const cuenta = await getCuentaCliente(organization.id)
  const desde = todos ? null : new Date(Date.now() - 365 * 86_400_000).toISOString()
  const pedidos = cuenta ? await pedidosDeCuenta(organization.id, cuenta, { limite: todos ? 200 : 100, desde }) : []

  const filtrados = pedidos.filter((p) => coincideBusqueda({ order_number: p.numero, productos: p.productos.map((x) => x.nombre) }, q))
  const conteo = { en_curso: 0, anteriores: 0, cancelados: 0 }
  for (const p of filtrados) conteo[p.grupo]++
  // Sin pestaña elegida: la primera con pedidos (En curso si hay alguno).
  const pedida = typeof params.vista === 'string' ? leerGrupo(params.vista) : (GRUPOS_PEDIDO.find((g) => conteo[g.clave] > 0)?.clave ?? 'en_curso')
  const lista = filtrados.filter((p) => p.grupo === pedida)
  const enlace = (extra: Record<string, string | null>) => {
    const u = new URLSearchParams()
    const base: Record<string, string | null> = { vista: pedida, q: q || null, todos: todos ? '1' : null, ...extra }
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v)
    const s = u.toString()
    return `/mi-cuenta/pedidos${s ? `?${s}` : ''}`
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 md:text-[28px]">Mis pedidos</h1>
          <p className="text-sm text-slate-600 md:text-[15px]">Incluye los que hiciste sin cuenta con este correo.</p>
        </div>
        <form method="GET" action="/mi-cuenta/pedidos" className="relative w-full md:w-[310px]" role="search">
          <input type="hidden" name="vista" value={pedida} />
          {todos && <input type="hidden" name="todos" value="1" />}
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Buscar por número o producto"
            placeholder="Buscar por número o producto"
            className="h-11 w-full rounded-[10px] border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--primary-color)]"
          />
        </form>
      </div>

      <nav aria-label="Estado de los pedidos" className="flex gap-6 overflow-x-auto border-b border-slate-200">
        {GRUPOS_PEDIDO.map((g) => {
          const activo = g.clave === pedida
          return (
            <Link
              key={g.clave}
              href={enlace({ vista: g.clave })}
              aria-current={activo ? 'page' : undefined}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-2.5 text-[15px] ${activo ? 'font-semibold' : 'border-transparent font-medium text-slate-600 hover:text-slate-900'}`}
              style={activo ? { borderColor: 'var(--primary-color)', color: 'var(--primary-color)' } : undefined}
            >
              {g.texto}
              <span className="rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-700">{conteo[g.clave]}</span>
            </Link>
          )
        })}
      </nav>

      {cuenta && !cuenta.verificado ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Confirma tu correo para ver tus pedidos: sal y vuelve a entrar con el código que te enviamos al correo.
        </p>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border border-slate-200 bg-white p-8 text-center">
          <Package aria-hidden="true" className="h-8 w-8 text-slate-400" />
          <p className="font-semibold text-slate-900">{q ? 'No hay pedidos que coincidan' : pedida === 'en_curso' ? 'No tienes pedidos en curso' : pedida === 'cancelados' ? 'No tienes pedidos cancelados' : 'Aún no tienes pedidos anteriores'}</p>
          {!q && pedidos.length === 0 && (
            <Link href={esRestaurante ? '/menu' : '/productos'} className="mt-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary-color)' }}>
              Explorar productos
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {lista.map((p) => (
            <TarjetaPedido key={p.id} p={p} esRestaurante={esRestaurante} zona={zona} detalle={detallePedido(p, esRestaurante, zona)} />
          ))}
        </div>
      )}

      <p className="text-[13px] text-slate-600">
        {todos ? (
          'Mostrando todos tus pedidos.'
        ) : (
          <>
            Mostrando los pedidos de los últimos 12 meses ·{' '}
            <Link href={enlace({ todos: '1' })} className="font-medium hover:underline">
              Ver más antiguos
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
