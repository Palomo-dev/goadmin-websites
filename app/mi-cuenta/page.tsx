import { Metadata } from 'next'
import Link from '@/components/site/Enlace'
import { Check, FileText, MessageCircle, Pencil, Plus, ShoppingBag, Truck } from 'lucide-react'
import { getOrgContext } from '@/lib/get-org-context'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { getCustomerDashboardCounts, getCustomerServiceDashboard } from '@/lib/queries/customer-portal'
import { cifrasCuenta, getCuentaCliente, pedidosDeCuenta } from '@/lib/cuenta/cuentaCliente'
import {
  avisoCompletarCuenta,
  facturaCompleta,
  filasMenuCuenta,
  identidadCuenta,
  pasosCuenta,
  pedidoEnCurso,
  textoClienteDesde,
  textoProductos,
  vendeConPedidos,
  type CifrasCuenta,
  type ClaveMenuCuenta,
  type FilaMenuCuenta,
  type PasoCuenta,
} from '@/lib/cuenta/reglasCuenta'
import { ayudaCuenta } from '@/lib/cuenta/ayudaCuenta'
import { BarraPasos, FilaPedidoReciente, FotosPedido, Insignia, avanceDe } from '@/components/site/cuenta/PedidosCuenta'
import { AvisoFaltan, ListaMenuCuenta } from '@/components/site/cuenta/MenuMiCuenta'
import { AvatarCuenta } from '@/components/site/cuenta/avatar/AvatarCuenta'
import { EstadoVacioCuenta } from '@/components/site/cuenta/EstadoVacioCuenta'
import { ICONOS_CUENTA } from '@/components/site/cuenta/iconosCuenta'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mi cuenta' }
  return { title: `Mi cuenta | ${ctx.organization.name}`, robots: { index: false, follow: false } }
}

const TONO_SUAVE = { backgroundColor: 'color-mix(in srgb, var(--primary-color) 10%, white)' }

/** Tarjeta de acceso del escritorio (Figma 3048:79256): ícono, cifra grande, nombre y detalle. */
function TarjetaAcceso({ f }: { f: FilaMenuCuenta }) {
  const Icono = ICONOS_CUENTA[f.clave]
  return (
    <Link href={f.href} className="flex min-w-0 flex-col gap-2 rounded-[14px] border border-slate-200 bg-white p-[18px] transition-shadow hover:shadow-sm">
      <span className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={TONO_SUAVE} aria-hidden="true">
          <Icono className="h-[18px] w-[18px]" style={{ color: 'var(--primary-color)' }} strokeWidth={1.75} />
        </span>
        {f.aviso ? <AvisoFaltan texto={f.aviso} /> : f.cifra ? <span className="text-2xl font-semibold leading-none text-slate-900">{f.cifra}</span> : null}
      </span>
      <span className="text-[15px] font-semibold text-slate-900">{f.texto}</span>
      {f.detalle && <span className="text-[13px] leading-snug text-slate-600">{f.detalle}</span>}
    </Link>
  )
}

/** «Completa tu cuenta · 1 de 3» (Figma 3047:79269): tres pasos calculados, sin columnas. */
function CompletaTuCuenta({ pasos }: { pasos: PasoCuenta[] }) {
  const hechos = pasos.filter((p) => p.hecho).length
  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-4 md:p-5" aria-label="Completa tu cuenta">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Completa tu cuenta</h2>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--primary-color)' }}>
          {hechos} de {pasos.length}
        </span>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {pasos.map((p) => (
          <span key={p.clave} className={`h-1 flex-1 rounded-sm ${p.hecho ? '' : 'bg-slate-200'}`} style={p.hecho ? { backgroundColor: 'var(--primary-color)' } : undefined} />
        ))}
      </div>
      <ul className="flex flex-col">
        {pasos.map((p) => {
          const marca = p.hecho ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--primary-color)' }}>
              <Check aria-hidden="true" className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
          ) : (
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
          )
          const texto = <span className={`flex-1 text-[15px] ${p.hecho ? 'text-slate-400' : 'font-medium text-slate-900'}`}>{p.texto}</span>
          return (
            <li key={p.clave}>
              {p.hecho || !p.href ? (
                <span className="flex items-center gap-3 py-2">
                  {marca}
                  {texto}
                  <span className="sr-only">{p.hecho ? '(hecho)' : '(pendiente)'}</span>
                </span>
              ) : (
                <Link href={p.href} className="flex items-center gap-3 py-2">
                  {marca}
                  {texto}
                  <span aria-hidden="true" className="text-slate-400">›</span>
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Mi cuenta › Inicio V2 (Figma «16 Sitio web» 3044:78726: celular 3047:78865 y 3047:79269,
 * escritorio 3048:79256; aprobado 2026-11-24). Cabecera con avatar, nombre de la ficha, correo y
 * «Cliente desde…» (sin nombre: el correo y «Agrega tu nombre»); el pedido en curso con su avance
 * y «Seguir pedido»; «Completa tu cuenta» o la tarjeta «Faltan tus datos de factura»; accesos en
 * grupos (Compras · Mi información · Ayuda) con cifras que dicen algo; pedidos recientes y ayuda
 * por WhatsApp en escritorio. Las verticales sin pedidos (hotel, servicios, gimnasio, transporte,
 * parqueadero) conservan sus accesos y cifras de siempre.
 */
export default async function MiCuentaInicio() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, effectiveSettings, footerNav } = ctx
  const typeId = organization.type_id ?? 0
  const esComercio = vendeConPedidos(typeId)
  const esRestaurante = typeId === 1
  const zona = ((organization as { timezone?: string | null }).timezone ?? null) as string | null

  const cuenta = await getCuentaCliente(organization.id)
  const cliente = cuenta?.cliente ?? null
  const [pedidos, cifras, conteos, servicios] = await Promise.all([
    cuenta && esComercio ? pedidosDeCuenta(organization.id, cuenta, { limite: 30 }) : Promise.resolve([]),
    // Las mismas del menú lateral (react.cache): no vuelve a consultar.
    cifrasCuenta(organization.id, cuenta, esComercio),
    cliente && !esComercio && typeId !== 4 ? getCustomerDashboardCounts(cliente.id, organization.id) : Promise.resolve(null),
    cliente && typeId === 4 ? getCustomerServiceDashboard(cliente.id, organization.id) : Promise.resolve(null),
  ])

  const identidad = identidadCuenta(cliente, cuenta?.correo ?? null)
  const primerNombre = (cliente?.first_name || '').trim().split(/\s+/)[0] || null
  const desde = textoClienteDesde(cliente?.created_at, zona)
  const enCurso = pedidoEnCurso(pedidos)
  const avance = enCurso ? avanceDe(enCurso, esRestaurante) : null
  const recientes = pedidos.filter((p) => p.id !== enCurso?.id).slice(0, 3)
  const pasos = pasosCuenta({ verificado: !!cuenta?.verificado, ficha: cliente })
  const aviso = cliente ? avisoCompletarCuenta(pasos) : null
  const ayuda = ayudaCuenta(effectiveSettings, footerNav)

  // Cifras de las demás verticales (las de siempre) para sus accesos.
  const otras: Partial<Record<ClaveMenuCuenta, number>> = {}
  if (conteos) {
    otras.reservas = conteos.reservations
    otras.membresia = conteos.memberships
    otras.checkins = conteos.checkins
    otras.tickets = conteos.tickets
    otras.pases = conteos.passes
    otras.vehiculos = conteos.vehicles
    otras.historial = conteos.sessions
  }
  if (servicios) {
    otras.citas = servicios.upcomingAppointments
    otras.cotizaciones = servicios.openQuotes
  }
  const conOtras: CifrasCuenta = { ...cifras, otras }
  const grupos = filasMenuCuenta(typeId, conOtras, { nombre: identidad.nombre, telefono: cliente?.phone ?? null, facturaCompleta: facturaCompleta(cliente), zona })
  if (servicios) {
    // Servicios: las facturas son las de sus citas (pendientes de pago), no las de pedidos.
    for (const g of grupos) {
      for (const f of g.filas) {
        if (f.clave !== 'facturas') continue
        f.cifra = servicios.pendingInvoices > 0 ? String(servicios.pendingInvoices) : null
        f.detalle = servicios.pendingInvoices > 0 ? `${servicios.pendingInvoices} por pagar` : 'Tus facturas'
      }
    }
  }
  const sinPedidos = esComercio && !!cuenta?.verificado && pedidos.length === 0
  const rutaProductos = esRestaurante ? '/menu' : '/productos'

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera: avatar, nombre (o correo) y desde cuándo es cliente */}
      <div className="flex items-start gap-3.5 md:items-center">
        <AvatarCuenta iniciales={identidad.iniciales} primaryColor={primaryColor} tam={56} className="md:hidden" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-[22px] font-semibold leading-snug text-slate-900 md:text-[28px]">
            <span className="md:hidden">{identidad.titulo}</span>
            <span className="hidden md:inline">{primerNombre ? `Hola, ${primerNombre}` : 'Hola'}</span>
          </h1>
          {identidad.nombre ? (
            <>
              {identidad.correo && <p className="truncate text-sm text-slate-600 md:hidden">{identidad.correo}</p>}
              {desde && <p className="text-[13px] text-slate-500 md:hidden">{desde}</p>}
            </>
          ) : (
            <Link href="/mi-cuenta/perfil" className="inline-flex items-center gap-1 text-sm font-medium md:hidden" style={{ color: 'var(--primary-color)' }}>
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Agrega tu nombre
            </Link>
          )}
          <p className="hidden truncate text-[15px] text-slate-600 md:block">{[desde, identidad.correo].filter(Boolean).join(' · ') || `Tu cuenta en ${organization.name}`}</p>
        </div>
        <Link
          href="/mi-cuenta/perfil"
          aria-label="Editar mis datos"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 md:h-auto md:w-auto md:gap-2 md:rounded-[10px] md:px-4 md:py-2.5 md:text-sm md:font-semibold md:text-slate-900"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          <span className="hidden md:inline">Editar mis datos</span>
        </Link>
      </div>

      {cuenta && !cuenta.verificado && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Confirma tu correo para ver tus pedidos: sal y vuelve a entrar con el código que te enviamos al correo.
        </p>
      )}

      {/* Pedido en curso */}
      {enCurso && avance && (
        <section className="flex flex-col gap-3.5 rounded-[14px] border border-slate-200 bg-white p-4 md:p-5" aria-label="Tu pedido en curso">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-600">Tu pedido en curso</p>
              <p className="text-[15px] font-semibold text-slate-900 md:hidden">
                Pedido {enCurso.numero} · {textoProductos(enCurso.cantidadProductos)}
              </p>
              <p className="hidden text-lg font-semibold text-slate-900 md:block">{avance.titulo}</p>
            </div>
            <Insignia texto={avance.insignia} tono={avance.tono} />
          </div>
          <p className="text-[15px] font-medium text-slate-900 md:hidden">{avance.titulo}</p>
          <BarraPasos pasos={avance.pasos} />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <FotosPedido p={enCurso} />
            <p className="hidden min-w-0 flex-1 text-sm font-medium text-slate-900 md:block">
              Pedido {enCurso.numero} · {textoProductos(enCurso.cantidadProductos)}
            </p>
            <Link
              href={enCurso.rutaDetalle}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 md:py-2.5"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              <Truck aria-hidden="true" className="h-4 w-4" /> {enCurso.acciones.includes('pagar') ? 'Pagar mi pedido' : 'Seguir pedido'}
            </Link>
          </div>
        </section>
      )}

      {/* Completa tu cuenta (cuenta nueva) o solo los datos de factura */}
      {aviso === 'lista' && <CompletaTuCuenta pasos={pasos} />}
      {aviso === 'factura' && (
        <div className="flex flex-col gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3 md:items-center">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-amber-100" aria-hidden="true">
              <FileText className="h-[18px] w-[18px] text-amber-700" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-slate-900">Faltan tus datos de factura</p>
              <p className="text-[13px] leading-snug text-slate-600">Tipo y número de documento. Así tus facturas salen a tu nombre sin pedírtelos en cada compra.</p>
            </div>
          </div>
          <Link href="/mi-cuenta/perfil#factura" className="self-start rounded-[10px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 md:ml-12 md:self-auto">
            Completar datos
          </Link>
        </div>
      )}

      {/* Sin pedidos: una invitación, no un «0» */}
      {sinPedidos && (
        <EstadoVacioCuenta
          icono={ShoppingBag}
          titulo="Aún no tienes pedidos"
          texto="Cuando compres, aquí verás cómo va tu pedido y podrás seguirlo."
          accion={{ texto: 'Ver productos', href: rutaProductos }}
        />
      )}

      {/* Celular: los accesos agrupados */}
      <ListaMenuCuenta grupos={grupos} ayuda={ayuda} correo={identidad.nombre ? identidad.correo : null} />

      {/* Escritorio: los mismos accesos en tarjetas, por grupo */}
      {grupos.map((g) => (
        <section key={g.clave} className="hidden flex-col gap-2.5 md:flex" aria-label={g.titulo}>
          <h2 className="text-sm font-semibold text-slate-600">{g.titulo}</h2>
          <div className={`grid gap-4 ${g.filas.length >= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {g.filas.map((f) => (
              <TarjetaAcceso key={f.clave} f={f} />
            ))}
          </div>
        </section>
      ))}

      {/* Pedidos recientes (escritorio) */}
      {esComercio && recientes.length > 0 && (
        <section className="hidden flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-5 md:flex" aria-label="Pedidos recientes">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Pedidos recientes</h2>
            <Link href="/mi-cuenta/pedidos?vista=anteriores" className="text-sm font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
              Ver todos →
            </Link>
          </div>
          {recientes.map((p) => (
            <FilaPedidoReciente key={p.id} p={p} esRestaurante={esRestaurante} zona={zona} />
          ))}
        </section>
      )}

      {/* Ayuda (escritorio) */}
      {ayuda.whatsapp && (
        <section className="hidden items-center gap-4 rounded-[14px] border border-slate-200 bg-white p-5 md:flex" aria-label="Ayuda">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50" aria-hidden="true">
            <MessageCircle className="h-5 w-5 text-green-700" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-slate-900">{esComercio ? '¿Necesitas ayuda con un pedido?' : '¿Necesitas ayuda?'}</p>
            <p className="text-[13px] text-slate-600">
              Escríbenos por WhatsApp al {ayuda.whatsapp.telefono}
              {ayuda.politicas && (
                <>
                  {' · '}
                  <Link href={ayuda.politicas} className="hover:underline">
                    Políticas de la tienda
                  </Link>
                </>
              )}
            </p>
          </div>
          <a href={ayuda.whatsapp.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            <MessageCircle aria-hidden="true" className="h-4 w-4" /> Escribir por WhatsApp
          </a>
        </section>
      )}
    </div>
  )
}
