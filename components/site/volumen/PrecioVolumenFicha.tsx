'use client'

/**
 * «Compra más, paga menos» en la ficha (Figma «16 Sitio web» S1 3008:75742, S2 3009:75814 celular,
 * S1b 3008:75895 sin sesión). Lo monta `PrecioFicha` cuando el producto tiene precio por volumen.
 *
 *  - Precio por unidad que cambia con la cantidad elegida en la ficha (evento de cantidad de
 *    ProductDetailActions / VariantSelector), con el normal tachado y «−14 %».
 *  - Tabla de escalones («1 a 5 unidades / 6 a 11 / 12 o más», «Tu precio», «Ahorras 14 %»):
 *    tocar un escalón pide esa cantidad al selector (lib/products/pedirCantidad.ts).
 *  - «Total $ … · Ahorras $ …» y el empujón «Agrega 6 más y cada una te queda en $ 8.800 · Llevar 12».
 *  - Cómo cuentan las unidades (`tiers_count_mode`) y hasta cuándo vale.
 *  - S1b: si la promoción es solo para un grupo de clientes, NO se muestran sus precios: solo la
 *    invitación a ingresar (el servidor verifica el grupo con la sesión al cobrar).
 *
 * Lo que se cobra lo decide el servidor (/api/orders); esto es la misma cuenta para mostrarla.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import Link from '@/components/site/Enlace'
import { Check, Clock, Layers, Lock, TrendingUp } from 'lucide-react'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { escucharCantidad } from '@/lib/products/varianteSeleccionada'
import { pedirCantidad } from '@/lib/products/pedirCantidad'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { createClient } from '@/lib/supabase/client'
import { cotizarCantidad, etiquetaFila, filasEscalones, textoModoConteo, type VolumenProducto } from '@/lib/promociones/escalonesTienda'
import { useFichaVolumen, useZonaEscalones } from './EscalonesTiendaContext'

interface PrecioVolumenFichaProps {
  volumen: VolumenProducto
  /** Precio base de la unidad (el de la ficha o la variante). */
  precio: number
  /** Precio anterior de la ficha (compare_price), si lo hay. */
  comparacion: number | null
  /** Variante elegida (con variantes) o null (producto simple). */
  varianteId: number | null
  primaryColor: string
  /** El precio de siempre (para S1b, donde no se promete el precio por volumen). */
  precioNormal: ReactNode
}

const VERDE = '#15803D'

/** «31 de diciembre» en la zona de la organización (end_date es timestamptz). */
function fechaFin(fin: string | null, zona: string): string | null {
  if (!fin) return null
  const d = new Date(fin)
  if (!Number.isFinite(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: zona }).format(d)
  } catch {
    return null
  }
}

/** Cantidad elegida en la ficha para `id` (empieza en 1). */
function useCantidadFicha(ids: number[], id: number | null): number {
  const ORIGEN = useId()
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const clave = ids.join(',')
  useEffect(() => {
    const validos = new Set(ids)
    return escucharCantidad(ORIGEN, (productoId, cantidad) => {
      if (!validos.has(productoId) || !(cantidad >= 1)) return
      setCantidades((c) => (c[productoId] === cantidad ? c : { ...c, [productoId]: cantidad }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, ORIGEN])
  return id != null ? cantidades[id] ?? 1 : 1
}

export function PrecioVolumenFicha({ volumen, precio, comparacion, varianteId, primaryColor, precioNormal }: PrecioVolumenFichaProps) {
  const ficha = useFichaVolumen()
  const zona = useZonaEscalones()
  const { formatPrice } = useCurrency()
  const productoId = ficha?.producto.id ?? null
  const ids = useMemo(() => [productoId, ...(ficha?.variantes ?? [])].filter((x): x is number => x != null), [productoId, ficha?.variantes])
  const idActual = varianteId ?? productoId
  const cantidad = useCantidadFicha(ids, idActual)

  if (volumen.requiereCliente || volumen.escalones.length === 0) {
    return (
      <div data-precio-volumen="solo-clientes">
        {precioNormal}
        <InvitacionIngresar primaryColor={primaryColor} />
      </div>
    )
  }

  const cot = cotizarCantidad(volumen.escalones, precio, cantidad)
  const filas = filasEscalones(volumen.escalones, precio)
  const conEscalon = cot.unitario < Math.round(precio)
  // Tachado: el precio normal si el escalón baja el precio; si no, el anterior de la ficha.
  const tachado = conEscalon ? Math.max(Math.round(precio), comparacion ?? 0) : comparacion !== null && comparacion > precio ? comparacion : null
  const pctChip = tachado ? Math.round((1 - cot.unitario / tachado) * 100) : 0
  const elegir = (q: number) => idActual != null && pedirCantidad([idActual], q)
  const fin = fechaFin(volumen.fin, zona)
  const tint = `${primaryColor}14`

  return (
    <div data-precio-volumen="" className="space-y-3">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1" data-precio-ficha>
          <span className="text-4xl font-bold text-gray-900 dark:text-white">{formatPrice(cot.unitario)}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">c/u</span>
          {tachado && <span className="text-base text-gray-400 line-through">{formatPrice(tachado)}</span>}
          {pctChip > 0 && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold dark:bg-green-900/20" style={{ color: VERDE }}>
              −{pctChip} %
            </span>
          )}
        </div>
        {conEscalon && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Tu precio por llevar {cot.cantidad}. El precio cambia solo cuando cambias la cantidad.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border dark:border-gray-700" data-escalones="">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5" style={{ backgroundColor: tint }}>
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: primaryColor }}>
            <Layers className="h-4 w-4" aria-hidden="true" />
            Compra más, paga menos
          </p>
          <p className="hidden text-xs sm:block" style={{ color: primaryColor }}>Toca un escalón para elegir esa cantidad</p>
        </div>

        {/* Computador: filas */}
        <ul className="hidden divide-y sm:block dark:divide-gray-700">
          {filas.map((f) => {
            const activa = cot.cantidad >= f.desde && (f.hasta == null || cot.cantidad <= f.hasta)
            return (
              <li key={f.desde}>
                <button
                  type="button"
                  onClick={() => elegir(f.desde)}
                  aria-pressed={activa}
                  className="flex w-full items-center justify-between gap-3 border-l-4 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  style={{ borderLeftColor: activa ? primaryColor : 'transparent', backgroundColor: activa ? tint : undefined }}
                >
                  <span className={`flex items-center gap-2 ${activa ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {etiquetaFila(f)}
                    {activa && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: primaryColor }}>
                        <Check className="h-3 w-3" aria-hidden="true" /> Tu precio
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    {f.ahorroPct > 0 && <span className="text-xs" style={{ color: VERDE }}>Ahorras {f.ahorroPct} %</span>}
                    <span className={activa ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}>{formatPrice(f.precio)} c/u</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* Celular: tarjetas */}
        <div className={`grid gap-2 p-3 sm:hidden ${filas.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {filas.map((f) => {
            const activa = cot.cantidad >= f.desde && (f.hasta == null || cot.cantidad <= f.hasta)
            return (
              <button
                key={f.desde}
                type="button"
                onClick={() => elegir(f.desde)}
                aria-pressed={activa}
                className="rounded-lg border bg-white px-2 py-2 text-center dark:bg-gray-900"
                style={{ borderColor: activa ? primaryColor : undefined, backgroundColor: activa ? tint : undefined, borderWidth: activa ? 2 : 1 }}
              >
                <span className="block text-xs text-gray-500 dark:text-gray-400">{etiquetaFila(f, true)}</span>
                <span className="block text-sm font-bold text-gray-900 dark:text-white">{formatPrice(f.precio)}</span>
                <span className="block text-[11px]" style={{ color: f.ahorroPct > 0 ? VERDE : undefined }}>
                  {f.ahorroPct > 0 ? `−${f.ahorroPct} %` : 'precio normal'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {cot.cantidad > 1 && (
        <div className="flex items-baseline justify-between gap-3 text-sm" data-total-volumen="">
          <span className="text-gray-600 dark:text-gray-400">Llevas {cot.cantidad}</span>
          <span className="text-right">
            <span className="block font-bold text-gray-900 dark:text-white">Total {formatPrice(cot.total)}</span>
            {cot.ahorro > 0 && <span className="block text-xs" style={{ color: VERDE }}>Ahorras {formatPrice(cot.ahorro)}</span>}
          </span>
        </div>
      )}

      {cot.siguiente && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: tint, color: primaryColor }} data-empujon-volumen="">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            Agrega {cot.siguiente.faltan} más y cada una te queda en {formatPrice(cot.siguiente.unitario)}.
          </span>
          <button type="button" onClick={() => elegir(cot.siguiente!.desde)} className="flex-shrink-0 font-semibold underline-offset-2 hover:underline">
            Llevar {cot.siguiente.desde}
          </button>
        </div>
      )}

      <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {textoModoConteo(volumen.modo)}
        </li>
        {fin && (
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Oferta válida hasta el {fin}.
          </li>
        )}
      </ul>
    </div>
  )
}

/**
 * S1b: hay precios por volumen solo para un grupo de clientes. Sin sesión, invita a ingresar; con
 * sesión, avisa que el carrito los aplica si su cuenta los tiene (el servidor lo verifica). La
 * sesión se lee del navegador (sin consulta a la base).
 */
function InvitacionIngresar({ primaryColor }: { primaryColor: string }) {
  const { ruta } = useRutaSitio()
  const [conSesion, setConSesion] = useState<boolean | null>(null)
  useEffect(() => {
    let vigente = true
    createClient().auth.getSession()
      .then(({ data }) => { if (vigente) setConSesion(!!data.session?.user) })
      .catch(() => { if (vigente) setConSesion(false) })
    return () => { vigente = false }
  }, [])

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50" data-volumen-solo-clientes="">
      <Lock className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">¿Compras para tu negocio?</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {conSesion
            ? 'Hay precios por volumen para algunos clientes. Si tu cuenta los tiene, los verás en el carrito.'
            : 'Hay precios por volumen para clientes registrados. Ingresa para verlos.'}
        </p>
      </div>
      {conSesion === false && (
        <Link href={ruta('/auth')} className="flex-shrink-0 text-sm font-semibold" style={{ color: primaryColor }}>
          Ingresar
        </Link>
      )}
    </div>
  )
}

/** Insignia sobre la foto de la ficha («Compra más, paga menos»). */
export function InsigniaVolumenFoto({ primaryColor }: { primaryColor?: string }) {
  return (
    <span
      className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm"
      style={{ backgroundColor: primaryColor || '#EA8A2E' }}
      data-insignia-volumen=""
    >
      <Layers className="h-3.5 w-3.5" aria-hidden="true" />
      Compra más, paga menos
    </span>
  )
}
