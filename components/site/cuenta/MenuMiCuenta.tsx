'use client'

/**
 * Menú de Mi cuenta (Figma «16 Sitio web» D 2976:72025 escritorio y H 2977:72694 celular). Reemplaza
 * al menú lateral con emojis; los ítems salen de `menuCuenta(tipo de negocio)` (reservas, citas,
 * membresía, pases… siguen ahí según el negocio).
 * - Escritorio: tarjeta lateral con iniciales, nombre y correo, el ítem activo resaltado y
 *   «Cerrar sesión» abajo.
 * - Celular: en Inicio, la lista con la cifra de cada acceso; en las demás páginas, la barra
 *   «← Volver a Mi cuenta» (VolverMiCuenta).
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  CalendarClock,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronRight,
  CircleUser,
  ClipboardList,
  Dumbbell,
  FileText,
  Heart,
  History,
  Home,
  LogOut,
  MapPin,
  Package,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import { itemActivo, type ClaveMenuCuenta, type ItemMenuCuenta } from '@/lib/cuenta/reglasCuenta'
import { cerrarSesionTienda } from './useAcceso'
import { navegacionCuenta } from '@/lib/navegacion/volver'
import { BarraVolverMovil } from '@/components/site/volver/BarraVolverMovil'
import { EncabezadoPagina } from '@/components/site/volver/EncabezadoPagina'

const ICONOS: Record<ClaveMenuCuenta, LucideIcon> = {
  inicio: Home,
  pedidos: Package,
  direcciones: MapPin,
  favoritos: Heart,
  cupones: Ticket,
  facturas: FileText,
  datos: CircleUser,
  reservas: CalendarDays,
  citas: CalendarClock,
  cotizaciones: ClipboardList,
  membresia: Dumbbell,
  clases: CalendarDays,
  checkins: CheckCircle2,
  tickets: Ticket,
  pases: Ticket,
  vehiculos: Car,
  historial: History,
}

function useSalir() {
  const [saliendo, setSaliendo] = useState(false)
  const salir = async () => {
    setSaliendo(true)
    await cerrarSesionTienda()
    window.location.href = '/'
  }
  return { saliendo, salir }
}

export function MenuLateralCuenta({ items, nombre, correo, iniciales }: { items: ItemMenuCuenta[]; nombre: string | null; correo: string | null; iniciales: string }) {
  const ruta = usePathname()
  const activo = itemActivo(items, ruta)
  const { saliendo, salir } = useSalir()
  return (
    <div className="flex flex-col gap-1 rounded-[14px] border border-slate-200 bg-white p-4" data-menu-mi-cuenta="">
      <div className="flex items-center gap-2.5 p-1.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary-color)' }} aria-hidden="true">
          {iniciales}
        </span>
        <span className="flex min-w-0 flex-col leading-snug">
          {nombre && <span className="truncate text-[15px] font-semibold text-slate-900">{nombre}</span>}
          {correo && <span className="truncate text-xs text-slate-600">{correo}</span>}
        </span>
      </div>
      <hr className="my-1 border-slate-200" />
      <nav aria-label="Mi cuenta" className="flex flex-col gap-1">
        {items.map((it) => {
          const Icono = ICONOS[it.clave]
          const es = activo === it.clave
          return (
            <Link
              key={it.clave}
              href={it.href}
              aria-current={es ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-lg p-2.5 text-sm transition-colors ${es ? 'font-semibold' : 'font-medium text-slate-900 hover:bg-slate-50'}`}
              style={es ? { backgroundColor: 'color-mix(in srgb, var(--primary-color) 10%, white)', color: 'var(--primary-color)' } : undefined}
            >
              <Icono aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {it.texto}
            </Link>
          )
        })}
      </nav>
      <hr className="my-1 border-slate-200" />
      <button type="button" onClick={() => void salir()} disabled={saliendo} className="flex items-center gap-2.5 rounded-lg p-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
        <LogOut aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}

/**
 * «Volver» de las páginas de Mi cuenta (Figma 2993:75276 y regla 2992:74856), en todas menos
 * Inicio: en el celular, la barra «← Volver a Mi cuenta» (o a la sección, en un detalle: «Volver a
 * Mis pedidos»); en escritorio, el ← al inicio de las migas Inicio › Mi cuenta › sección. Antes era
 * «‹ Mi cuenta» solo en el celular (Figma G 2977:72598) y cada detalle traía su «Volver» suelto.
 */
export function VolverMiCuenta({ items, primaryColor, colorCabecera }: { items: ItemMenuCuenta[]; primaryColor?: string | null; colorCabecera?: string | null }) {
  const ruta = usePathname() || ''
  const nav = navegacionCuenta(ruta, items)
  if (!nav) return null
  return (
    <>
      {/* Hija directa de la columna (no de un envoltorio) para quedar pegada al bajar. */}
      <BarraVolverMovil className="-mx-4 -mt-5 mb-4" padre={nav.padre} etiquetaActual={nav.actual} primaryColor={primaryColor} colorCabecera={colorCabecera} />
      <EncabezadoPagina tipo="ficha" migas={nav.migas} padre={nav.padre} primaryColor={primaryColor} className="mb-5" />
    </>
  )
}

/** Lista del celular en Inicio (Figma H 2977:72694): cada acceso con su cifra o aviso. */
export function ListaMenuCuenta({
  items,
  cifras = {},
  avisos = {},
}: {
  items: ItemMenuCuenta[]
  cifras?: Partial<Record<ClaveMenuCuenta, string>>
  avisos?: Partial<Record<ClaveMenuCuenta, string>>
}) {
  const { saliendo, salir } = useSalir()
  const lista = items.filter((it) => it.clave !== 'inicio')
  return (
    <div className="flex flex-col gap-3 md:hidden">
      <nav aria-label="Mi cuenta" className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
        {lista.map((it, i) => {
          const Icono = ICONOS[it.clave]
          return (
            <Link key={it.clave} href={it.href} className={`flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-slate-900 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
              <Icono aria-hidden="true" className="h-5 w-5 shrink-0" style={{ color: 'var(--primary-color)' }} strokeWidth={1.75} />
              <span className="flex-1">{it.texto}</span>
              {avisos[it.clave] ? (
                <span className="text-[13px] text-amber-700">{avisos[it.clave]}</span>
              ) : cifras[it.clave] ? (
                <span className="text-sm text-slate-600">{cifras[it.clave]}</span>
              ) : null}
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400" />
            </Link>
          )
        })}
      </nav>
      <button type="button" onClick={() => void salir()} disabled={saliendo} className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-600 disabled:opacity-60">
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}
