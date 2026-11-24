import { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, ClipboardList, Car, Dumbbell, FileText, Heart, MapPin, Package, Ticket, Truck, type LucideIcon } from 'lucide-react'
import { getOrgContext } from '@/lib/get-org-context'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { getCustomerDashboardCounts, getCustomerServiceDashboard } from '@/lib/queries/customer-portal'
import { getCuentaCliente, pedidosDeCuenta, resumenCuenta } from '@/lib/cuenta/cuentaCliente'
import { facturaCompleta, menuCuenta, pedidoEnCurso, textoProductos, type ClaveMenuCuenta } from '@/lib/cuenta/reglasCuenta'
import { BarraPasos, FilaPedidoReciente, FotosPedido, Insignia, avanceDe } from '@/components/site/cuenta/PedidosCuenta'
import { ListaMenuCuenta } from '@/components/site/cuenta/MenuMiCuenta'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mi cuenta' }
  return { title: `Mi cuenta | ${ctx.organization.name}`, robots: { index: false, follow: false } }
}

function Acceso({ icono: Icono, titulo, detalle, href }: { icono: LucideIcon; titulo: string; detalle: string; href: string }) {
  return (
    <Link href={href} className="flex min-w-0 flex-1 flex-col gap-2 rounded-[14px] border border-slate-200 bg-white p-[18px] transition-shadow hover:shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 10%, white)' }}>
        <Icono aria-hidden="true" className="h-[18px] w-[18px]" style={{ color: 'var(--primary-color)' }} strokeWidth={1.75} />
      </span>
      <span className="text-[15px] font-semibold text-slate-900">{titulo}</span>
      <span className="text-[13px] leading-snug text-slate-600">{detalle}</span>
    </Link>
  )
}

/**
 * Mi cuenta › Inicio (Figma «16 Sitio web» D 2976:72025 escritorio y H 2977:72694 celular):
 * saludo, el pedido en curso con su avance y «Seguir pedido», aviso de datos de factura por
 * completar, accesos con su cifra y pedidos recientes con «Volver a comprar». Las verticales sin
 * pedidos (hotel, servicios, gimnasio, transporte, parqueadero) conservan sus accesos de siempre.
 */
export default async function MiCuentaInicio() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization } = ctx
  const typeId = organization.type_id ?? 0
  const esComercio = typeId === 1 || typeId === 3
  const esRestaurante = typeId === 1
  const zona = ((organization as { timezone?: string | null }).timezone ?? null) as string | null

  const cuenta = await getCuentaCliente(organization.id)
  const cliente = cuenta?.cliente ?? null
  const [pedidos, resumen, conteos, servicios] = await Promise.all([
    cuenta && esComercio ? pedidosDeCuenta(organization.id, cuenta, { limite: 30 }) : Promise.resolve([]),
    cliente && esComercio ? resumenCuenta(organization.id, cliente.id) : Promise.resolve(null),
    cliente && !esComercio && typeId !== 4 ? getCustomerDashboardCounts(cliente.id, organization.id) : Promise.resolve(null),
    cliente && typeId === 4 ? getCustomerServiceDashboard(cliente.id, organization.id) : Promise.resolve(null),
  ])

  const nombre = (cliente?.first_name || '').trim().split(/\s+/)[0] || null
  const enCurso = pedidoEnCurso(pedidos)
  const avance = enCurso ? avanceDe(enCurso, esRestaurante) : null
  const recientes = pedidos.filter((p) => p.id !== enCurso?.id).slice(0, 3)
  const cuantosEnCurso = pedidos.filter((p) => p.grupo === 'en_curso').length
  const faltaFactura = !!cliente && !facturaCompleta(cliente)

  const cifras: Partial<Record<ClaveMenuCuenta, string>> = {}
  if (esComercio) {
    cifras.pedidos = String(pedidos.length)
    if (resumen) {
      cifras.direcciones = String(resumen.direcciones)
      cifras.favoritos = String(resumen.favoritos)
      cifras.cupones = String(resumen.cupones)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-snug text-slate-900 md:text-[28px]">{nombre ? `Hola, ${nombre}` : 'Hola'}</h1>
        <p className="hidden text-[15px] text-slate-600 md:block">
          {esComercio ? 'Aquí ves tus pedidos, tus direcciones y tus datos.' : `Tu cuenta en ${organization.name}.`}
        </p>
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
              <p className="hidden text-[13px] font-medium text-slate-600 md:block">Tu pedido en curso</p>
              <p className="text-[15px] font-semibold text-slate-900 md:hidden">Pedido {enCurso.numero}</p>
              <p className="text-[13px] text-slate-600 md:text-lg md:font-semibold md:text-slate-900">{avance.titulo}</p>
            </div>
            <Insignia texto={avance.insignia} tono={avance.tono} />
          </div>
          <div className="hidden md:block">
            <BarraPasos pasos={avance.pasos} />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="hidden md:block">
              <FotosPedido p={enCurso} />
            </div>
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

      {/* Datos de factura por completar (escritorio; en el celular va en la fila «Mis datos») */}
      {faltaFactura && (
        <div className="hidden items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 md:flex">
          <FileText aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Completa tus datos para la factura electrónica</p>
            <p className="text-[13px] text-slate-600">Tipo y número de documento. Así tus facturas salen a tu nombre sin pedírtelos en cada compra.</p>
          </div>
          <Link href="/mi-cuenta/perfil#factura" className="rounded-[10px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Completar
          </Link>
        </div>
      )}

      {/* Celular: la lista del menú con sus cifras */}
      <ListaMenuCuenta items={menuCuenta(typeId)} cifras={cifras} avisos={faltaFactura ? { datos: 'Faltan datos de factura' } : {}} />

      {/* Accesos con su cifra (escritorio) */}
      <div className="hidden gap-4 md:flex">
        {esComercio && (
          <>
            <Acceso icono={Package} titulo="Mis pedidos" href="/mi-cuenta/pedidos" detalle={`${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'}${cuantosEnCurso ? ` · ${cuantosEnCurso} en curso` : ''}`} />
            <Acceso
              icono={MapPin}
              titulo="Direcciones"
              href="/mi-cuenta/direcciones"
              detalle={resumen && resumen.direcciones > 0 ? `${resumen.direcciones} ${resumen.direcciones === 1 ? 'guardada' : 'guardadas'}${resumen.principal ? ` · ${resumen.principal} es la principal` : ''}` : 'Agrega una dirección'}
            />
            <Acceso icono={Heart} titulo="Favoritos" href="/favoritos" detalle={resumen && resumen.favoritos > 0 ? textoProductos(resumen.favoritos) : 'Guarda lo que te gusta'} />
            <Acceso
              icono={Ticket}
              titulo="Cupones"
              href="/mi-cuenta/cupones"
              detalle={
                resumen && resumen.cupones > 0
                  ? `${resumen.cupones} ${resumen.cupones === 1 ? 'disponible' : 'disponibles'}${resumen.cuponVenceEnDias !== null ? ` · 1 vence ${resumen.cuponVenceEnDias === 0 ? 'hoy' : `en ${resumen.cuponVenceEnDias} ${resumen.cuponVenceEnDias === 1 ? 'día' : 'días'}`}` : ''}`
                  : 'Sin cupones por ahora'
              }
            />
          </>
        )}
        {typeId === 2 && conteos && <Acceso icono={CalendarDays} titulo="Mis reservas" href="/mi-cuenta/reservas" detalle={`${conteos.reservations} ${conteos.reservations === 1 ? 'reserva' : 'reservas'}`} />}
        {typeId === 4 && servicios && (
          <>
            <Acceso icono={CalendarDays} titulo="Mis citas" href="/mi-cuenta/citas" detalle={`${servicios.upcomingAppointments} próximas`} />
            <Acceso icono={FileText} titulo="Facturas" href="/mi-cuenta/facturas" detalle={`${servicios.pendingInvoices} pendientes`} />
            <Acceso icono={ClipboardList} titulo="Cotizaciones" href="/mi-cuenta/cotizaciones" detalle={`${servicios.openQuotes} abiertas`} />
          </>
        )}
        {typeId === 5 && conteos && (
          <>
            <Acceso icono={Dumbbell} titulo="Membresía" href="/mi-cuenta/membresia" detalle={conteos.memberships > 0 ? 'Activa' : 'Inactiva'} />
            <Acceso icono={CalendarDays} titulo="Mis clases" href="/mi-cuenta/clases" detalle="Reserva y revisa tus clases" />
            <Acceso icono={CheckCircle2} titulo="Check-ins" href="/mi-cuenta/checkins" detalle={`${conteos.checkins} registrados`} />
          </>
        )}
        {typeId === 6 && conteos && <Acceso icono={Ticket} titulo="Mis tickets" href="/mi-cuenta/tickets" detalle={`${conteos.tickets} ${conteos.tickets === 1 ? 'ticket' : 'tickets'}`} />}
        {typeId === 7 && conteos && (
          <>
            <Acceso icono={Ticket} titulo="Mis pases" href="/mi-cuenta/pases" detalle={`${conteos.passes} activos`} />
            <Acceso icono={Car} titulo="Vehículos" href="/mi-cuenta/vehiculos" detalle={`${conteos.vehicles} registrados`} />
            <Acceso icono={ClipboardList} titulo="Historial" href="/mi-cuenta/historial" detalle={`${conteos.sessions} sesiones`} />
          </>
        )}
      </div>

      {/* Pedidos recientes */}
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
    </div>
  )
}
