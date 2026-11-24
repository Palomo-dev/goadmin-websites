'use client'

/**
 * Menú de Mi cuenta V2 (Figma «16 Sitio web» 3044:78726, aprobado 2026-11-24; antes D 2976:72025 y
 * H 2977:72694). Los accesos salen de `filasMenuCuenta(tipo de negocio)` en grupos —Compras (o
 * reservas, citas, membresía, pases… según el negocio), Mi información (Mis datos, Direcciones y
 * Datos de factura como acceso propio) y Ayuda (WhatsApp de la tienda y políticas)— con cifras que
 * dicen algo y, en cero, una invitación en vez de «0».
 * - Escritorio: tarjeta lateral con avatar, nombre y correo, Inicio, los grupos con su cifra (punto
 *   ámbar en Datos de factura si faltan) y «Cerrar sesión» abajo.
 * - Celular: en Inicio, la lista agrupada (`ListaMenuCuenta`); en las demás páginas, el ← a Mi
 *   cuenta (VolverMiCuenta) y las pestañas deslizables (PestanasCuenta).
 */
import Link from '@/components/site/Enlace'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronRight, LogOut, MessageCircle, ScrollText, type LucideIcon } from 'lucide-react'
import { itemActivo, type GrupoFilasCuenta, type IdentidadCuenta, type ItemMenuCuenta } from '@/lib/cuenta/reglasCuenta'
import type { AyudaCuenta } from '@/lib/cuenta/ayudaCuenta'
import { cerrarSesionTienda } from './useAcceso'
import { navegacionCuenta } from '@/lib/navegacion/volver'
import { BarraVolverMovil } from '@/components/site/volver/BarraVolverMovil'
import { EncabezadoPagina } from '@/components/site/volver/EncabezadoPagina'
import { ICONOS_CUENTA } from './iconosCuenta'
import { AvatarCuenta } from './avatar/AvatarCuenta'
import { olvidarAvatar, sembrarIdentidadAvatar } from './avatar/datosAvatar'

function useSalir() {
  const [saliendo, setSaliendo] = useState(false)
  const salir = async () => {
    setSaliendo(true)
    await cerrarSesionTienda()
    olvidarAvatar()
    window.location.href = '/'
  }
  return { saliendo, salir }
}

/** Mi cuenta ya leyó la ficha: el avatar de la cabecera toma ese nombre sin esperar. */
export function SembrarAvatar({ usuario, identidad }: { usuario: string; identidad: IdentidadCuenta }) {
  useEffect(() => {
    sembrarIdentidadAvatar(usuario, identidad)
  }, [usuario, identidad])
  return null
}

function filasAyuda(ayuda: AyudaCuenta): { clave: string; texto: string; corto: string; detalle: string; href: string; externo: boolean; icono: LucideIcon }[] {
  const filas = []
  if (ayuda.whatsapp) filas.push({ clave: 'whatsapp', texto: 'WhatsApp de la tienda', corto: 'WhatsApp de la tienda', detalle: `Escríbenos: ${ayuda.whatsapp.telefono}`, href: ayuda.whatsapp.href, externo: true, icono: MessageCircle })
  if (ayuda.politicas) filas.push({ clave: 'politicas', texto: 'Políticas de la tienda', corto: 'Políticas', detalle: 'Envíos, cambios y devoluciones, privacidad', href: ayuda.politicas, externo: false, icono: ScrollText })
  return filas
}

export function MenuLateralCuenta({
  identidad,
  grupos,
  ayuda,
  primaryColor,
}: {
  identidad: IdentidadCuenta
  grupos: GrupoFilasCuenta[]
  ayuda: AyudaCuenta
  primaryColor?: string | null
}) {
  const ruta = usePathname()
  const todos: ItemMenuCuenta[] = [{ clave: 'inicio', texto: 'Inicio', href: '/mi-cuenta' }, ...grupos.flatMap((g) => g.filas.filter((f) => f.clave !== 'factura'))]
  const activo = itemActivo(todos, ruta)
  const { saliendo, salir } = useSalir()
  const ayudas = filasAyuda(ayuda)
  const claseFila = 'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors'
  const fila = (it: { clave: string; texto: string; href: string }, Icono: LucideIcon, derecha: React.ReactNode, es: boolean, externo = false) =>
    externo ? (
      <a key={it.clave} href={it.href} target="_blank" rel="noopener noreferrer" className={`${claseFila} font-medium text-slate-900 hover:bg-slate-50`}>
        <Icono aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        <span className="flex-1">{it.texto}</span>
        {derecha}
      </a>
    ) : (
      <Link
        key={it.clave}
        href={it.href}
        aria-current={es ? 'page' : undefined}
        className={`${claseFila} ${es ? 'font-semibold' : 'font-medium text-slate-900 hover:bg-slate-50'}`}
        style={es ? { backgroundColor: 'color-mix(in srgb, var(--primary-color) 10%, white)', color: 'var(--primary-color)' } : undefined}
      >
        <Icono aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        <span className="flex-1">{it.texto}</span>
        {derecha}
      </Link>
    )
  return (
    <div className="flex flex-col gap-1 rounded-[14px] border border-slate-200 bg-white p-4" data-menu-mi-cuenta="">
      <div className="flex items-center gap-2.5 p-1.5">
        <AvatarCuenta iniciales={identidad.iniciales} primaryColor={primaryColor} tam={40} />
        <span className="flex min-w-0 flex-col leading-snug">
          <span className="truncate text-[15px] font-semibold text-slate-900">{identidad.titulo}</span>
          {identidad.nombre && identidad.correo && <span className="truncate text-xs text-slate-600">{identidad.correo}</span>}
        </span>
      </div>
      <nav aria-label="Mi cuenta" className="mt-1 flex flex-col gap-0.5">
        {fila({ clave: 'inicio', texto: 'Inicio', href: '/mi-cuenta' }, ICONOS_CUENTA.inicio, null, activo === 'inicio')}
        {grupos.map((g) => (
          <div key={g.clave} className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-1 pt-3 text-xs font-medium text-slate-500">{g.titulo}</p>
            {g.filas.map((f) =>
              fila(
                f,
                ICONOS_CUENTA[f.clave],
                f.aviso ? (
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-label={f.aviso} role="img" />
                ) : f.cifra ? (
                  <span className="text-[13px] text-slate-500">{f.cifra}</span>
                ) : null,
                activo === f.clave && f.clave !== 'factura',
              ),
            )}
          </div>
        ))}
        {ayudas.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-1 pt-3 text-xs font-medium text-slate-500">Ayuda</p>
            {ayudas.map((a) => fila({ clave: a.clave, texto: a.corto, href: a.href }, a.icono, null, false, a.externo))}
          </div>
        )}
      </nav>
      <hr className="my-1.5 border-slate-200" />
      <button type="button" onClick={() => void salir()} disabled={saliendo} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
        <LogOut aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}

/**
 * «Volver» de las páginas de Mi cuenta (Figma 2993:75276 y regla 2992:74856), en todas menos
 * Inicio: en el celular, el ← cuadrado de 32 px con «Mi cuenta» en letra pequeña (o la sección, en
 * un detalle: «Mis pedidos»); en escritorio, el ← al inicio de las migas Inicio › Mi cuenta › sección.
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

function IconoFila({ icono: Icono }: { icono: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 10%, white)' }} aria-hidden="true">
      <Icono className="h-5 w-5" style={{ color: 'var(--primary-color)' }} strokeWidth={1.75} />
    </span>
  )
}

/** Insignia ámbar «Faltan datos». */
export function AvisoFaltan({ texto }: { texto: string }) {
  return <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">{texto}</span>
}

/**
 * Lista del celular en Inicio (Figma 3047:78865 y 3047:79269): accesos agrupados (Compras, Mi
 * información, Ayuda) con su línea de detalle y cifra, «Cerrar sesión» al final sin protagonismo y
 * con qué correo entró.
 */
export function ListaMenuCuenta({ grupos, ayuda, correo }: { grupos: GrupoFilasCuenta[]; ayuda: AyudaCuenta; correo?: string | null }) {
  const { saliendo, salir } = useSalir()
  const ayudas = filasAyuda(ayuda)
  const claseFila = 'flex items-center gap-3 px-4 py-3'
  const contenido = (Icono: LucideIcon, texto: string, detalle: string, derecha: React.ReactNode) => (
    <>
      <IconoFila icono={Icono} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-medium text-slate-900">{texto}</span>
        {detalle && <span className="text-[13px] leading-snug text-slate-600">{detalle}</span>}
      </span>
      {derecha}
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
    </>
  )
  const bloque = (titulo: string, filas: React.ReactNode[]) => (
    <section key={titulo} className="flex flex-col gap-2" aria-label={titulo}>
      <h2 className="text-[13px] font-semibold text-slate-600">{titulo}</h2>
      <nav className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">{filas}</nav>
    </section>
  )
  const separador = (i: number) => (i > 0 ? 'border-t border-slate-100' : '')
  return (
    <div className="flex flex-col gap-5 md:hidden" data-lista-mi-cuenta="">
      {grupos.map((g) =>
        bloque(
          g.titulo,
          g.filas.map((f, i) => (
            <Link key={f.clave} href={f.href} className={`${claseFila} ${separador(i)}`}>
              {contenido(ICONOS_CUENTA[f.clave], f.texto, f.detalle, f.aviso ? <AvisoFaltan texto={f.aviso} /> : f.cifra ? <span className="text-[15px] font-semibold text-slate-900">{f.cifra}</span> : null)}
            </Link>
          )),
        ),
      )}
      {ayudas.length > 0 &&
        bloque(
          'Ayuda',
          ayudas.map((a, i) =>
            a.externo ? (
              <a key={a.clave} href={a.href} target="_blank" rel="noopener noreferrer" className={`${claseFila} ${separador(i)}`}>
                {contenido(a.icono, a.texto, a.detalle, null)}
              </a>
            ) : (
              <Link key={a.clave} href={a.href} className={`${claseFila} ${separador(i)}`}>
                {contenido(a.icono, a.texto, a.detalle, null)}
              </Link>
            ),
          ),
        )}
      <div className="flex flex-col items-center gap-1 pt-1">
        <button type="button" onClick={() => void salir()} disabled={saliendo} className="flex items-center justify-center gap-2 py-2 text-[15px] font-medium text-slate-600 disabled:opacity-60">
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
        {correo && <p className="text-xs text-slate-500">Entraste con {correo}</p>}
      </div>
    </div>
  )
}
