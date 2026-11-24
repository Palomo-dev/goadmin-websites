'use client'

/**
 * «Pago contra entrega» en el checkout (Figma «16 Sitio web» 3019:76125 › 08, 08c, 09, 10, 10c).
 *
 * La contraentrega ES el método «Efectivo» (`cash`) con condiciones encima. Este componente solo
 * PINTA lo que dice el servidor (`/api/contraentrega`, informativo): el monto del anticipo lo decide
 * `/api/orders` con sus propios montos. Sin condiciones en la tienda (`conCondiciones: false`) no
 * pinta nada y el checkout queda exactamente como hoy.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Info, MapPin, Package, ShieldCheck, User } from 'lucide-react'
import Enlace from '@/components/site/Enlace'
import type { MedioAlRecibir, MotivoNoDisponible, AnticipoContraentrega, TipoEntregaPedido } from '@/lib/contraentrega/reglaContraentrega'
import { descripcionContraentrega, lineaPlazoAnticipo, lineaSiNoRecibe, textoMedios, textoMotivo } from '@/lib/contraentrega/textosContraentrega'

export interface EstadoContraentrega {
  conCondiciones: boolean
  disponible: boolean
  motivos: MotivoNoDisponible[]
  anticipo: AnticipoContraentrega | null
  alRecibir: number
  medios: MedioAlRecibir[]
  texto: string | null
  pasarelas: { codigo: string; nombre: string }[]
  excluidos: { productId: number; nombre: string | null }[]
}

export interface EntradaContraentregaCheckout {
  habilitado: boolean
  branchId: number | null
  tipoEntrega: TipoEntregaPedido
  items: { productId: number; cantidad: number }[]
  subtotalProductos: number
  envio: number
  total: number
  direccion: { ciudad?: string; pais?: string; departamento?: string; barrio?: string }
}

/**
 * Consulta `/api/contraentrega` cuando cambia algo que la regla mira (con una espera corta mientras
 * la persona escribe la dirección). Devuelve el estado y la pasarela elegida para el anticipo (la
 * primera, en el orden de Finanzas › Métodos de pago, viene marcada).
 */
export function useContraentrega(e: EntradaContraentregaCheckout) {
  const [estado, setEstado] = useState<EstadoContraentrega | null>(null)
  const [pasarela, setPasarela] = useState<string | null>(null)
  const clave = JSON.stringify(e)
  const ultima = useRef(0)

  useEffect(() => {
    if (!e.habilitado) {
      setEstado(null)
      return
    }
    const id = ++ultima.current
    const t = setTimeout(() => {
      fetch('/api/contraentrega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((datos) => {
          if (id !== ultima.current) return
          setEstado(datos && datos.conCondiciones ? (datos as EstadoContraentrega) : null)
        })
        .catch(() => {
          // Sin respuesta: como hoy (el servidor igual valida al crear el pedido).
          if (id === ultima.current) setEstado(null)
        })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const codigos = useMemo(() => (estado?.pasarelas ?? []).map((p) => p.codigo), [estado])
  useEffect(() => {
    if (codigos.length === 0) setPasarela(null)
    else if (!pasarela || !codigos.includes(pasarela)) setPasarela(codigos[0])
  }, [codigos, pasarela])

  return { estado, pasarela, setPasarela }
}

const ICONO_MOTIVO: Partial<Record<MotivoNoDisponible['codigo'], typeof Info>> = {
  monto_minimo: Package,
  productos: Package,
  zona: MapPin,
  primera_compra: User,
}

/**
 * Estado apagado: el motivo y lo que el cliente puede hacer (pantalla 09 C–I). `ciudad` es la que
 * escribió el cliente (09 F). Sin `onCambiarDireccion` / `onQuitar`, esas acciones no se pintan.
 */
export function MotivoContraentrega({
  estado,
  fmt,
  hrefSeguirComprando,
  hrefIngresar,
  ciudad,
  onCambiarDireccion,
  onQuitar,
}: {
  estado: EstadoContraentrega
  fmt: (n: number) => string
  hrefSeguirComprando?: string | null
  hrefIngresar?: string | null
  ciudad?: string | null
  onCambiarDireccion?: (() => void) | null
  /** Quita del carrito los productos que no aplican (09 E «Quitar» / «Quitarlos y pagar contra entrega»). */
  onQuitar?: ((productIds: number[]) => void) | null
}) {
  const [verCuales, setVerCuales] = useState(false)
  const motivo = estado.motivos[0]
  if (!motivo) return null
  const { texto, accion } = textoMotivo(motivo, fmt, ciudad)
  const Icono = ICONO_MOTIVO[motivo.codigo] ?? Info
  const enlace = accion === 'Seguir comprando' ? hrefSeguirComprando : accion === 'Ingresar' ? hrefIngresar : null
  const excluidos = estado.excluidos
  return (
    <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700" role="note">
      <div className="flex gap-2">
        <Icono className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden />
        <div>
          <p>{texto}</p>
          {accion === 'Ver cuáles' ? (
            <button type="button" className="mt-1 font-medium underline" onClick={() => setVerCuales((v) => !v)} aria-expanded={verCuales}>
              {verCuales ? 'Ocultar' : 'Ver cuáles'}
            </button>
          ) : accion === 'Cambiar dirección' && onCambiarDireccion ? (
            <button type="button" className="mt-1 font-medium underline" onClick={onCambiarDireccion}>{accion}</button>
          ) : enlace ? (
            <Enlace href={enlace} className="mt-1 inline-block font-medium underline">{accion}</Enlace>
          ) : null}
        </div>
      </div>
      {verCuales && excluidos.length > 0 && (
        <>
          <ul className="mt-2 space-y-1 rounded-md border border-gray-200 bg-white p-2">
            {excluidos.map((p) => (
              <li key={p.productId} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0">
                  <span className="block text-gray-900">{p.nombre || `Producto ${p.productId}`}</span>
                  <span className="text-gray-500">se paga en línea</span>
                </span>
                {onQuitar && (
                  <button type="button" className="flex-shrink-0 font-medium underline" onClick={() => onQuitar([p.productId])}>Quitar</button>
                )}
              </li>
            ))}
          </ul>
          {onQuitar && (
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-gray-900"
              onClick={() => onQuitar(excluidos.map((p) => p.productId))}
            >
              {excluidos.length === 1 ? 'Quitarlo y pagar contra entrega' : 'Quitarlos y pagar contra entrega'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** Disponible: desglose (con anticipo), selector de pasarela (2 o más) y avisos (pantallas 08 / 08c). */
export function DetalleContraentrega({
  estado,
  total,
  fmt,
  pasarela,
  onPasarela,
  color,
}: {
  estado: EstadoContraentrega
  total: number
  fmt: (n: number) => string
  pasarela: string | null
  onPasarela: (codigo: string) => void
  color: string
}) {
  const a = estado.anticipo
  // «efectivo, datáfono o Nequi» (sin pasar «Nequi» a minúsculas).
  const medios = textoMedios(estado.medios)
  // El texto de la tienda manda; sin él, la descripción de 08 / 09 A.
  const descripcion = estado.texto || descripcionContraentrega(estado.medios, a)
  if (!a) {
    return (
      <div className="mt-2 space-y-1 text-sm text-gray-600">
        <p>{descripcion}</p>
        <p className="text-gray-900">Pagas {fmt(estado.alRecibir)} al recibir.</p>
      </div>
    )
  }
  const delEnvio = a.base === 'envio'
  return (
    <div className="mt-2 space-y-3 text-sm">
      <p className="font-medium" style={{ color }}>
        Paga hoy {fmt(a.monto)}{delEnvio ? ' del envío' : ''} y {fmt(estado.alRecibir)} al recibir.
      </p>
      <p className="text-gray-600">{descripcion}</p>
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex justify-between text-gray-900"><span>Hoy, en línea{delEnvio ? ' · el envío' : ''}</span><span className="font-semibold">{fmt(a.monto)}</span></div>
        <div className="mt-1 flex justify-between text-gray-900"><span>Al recibir · {medios}</span><span className="font-semibold">{fmt(estado.alRecibir)}</span></div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-xs text-gray-500"><span>Total del pedido</span><span>{fmt(total)}</span></div>
      </div>
      {estado.pasarelas.length > 1 && (
        <fieldset>
          <legend className="mb-2 font-medium text-gray-900">¿Con qué pagas {delEnvio ? 'el envío' : 'el anticipo'}?</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {estado.pasarelas.map((p) => (
              <label
                key={p.codigo}
                className="flex cursor-pointer items-center gap-2 rounded-lg border-2 bg-white px-3 py-2 text-gray-900"
                style={pasarela === p.codigo ? { borderColor: color } : { borderColor: '#e5e7eb' }}
              >
                <input
                  type="radio"
                  name="pasarela-anticipo"
                  value={p.codigo}
                  checked={pasarela === p.codigo}
                  onChange={() => onPasarela(p.codigo)}
                  className="h-4 w-4"
                  style={{ accentColor: color }}
                />
                <span className="font-medium">{p.nombre}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="flex gap-2 text-xs" style={{ color }}>
        <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <span>{lineaPlazoAnticipo(a.plazoMinutos, estado.pasarelas.length > 1 ? null : pasarela)}</span>
      </p>
      <p className="flex gap-2 text-xs text-gray-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <span>{lineaSiNoRecibe(a.siNoRecibe)}</span>
      </p>
    </div>
  )
}

/**
 * «Pagas hoy (el envío) $ 9.000 / Pagas al recibir $ 142.000» del resumen (08) y de la barra fija
 * (10). Solo con contraentrega disponible y con anticipo; si no, nada (el resumen de siempre).
 */
export function ResumenPagoContraentrega({
  estado,
  fmt,
  compacto = false,
}: {
  estado: EstadoContraentrega | null
  fmt: (n: number) => string
  compacto?: boolean
}) {
  if (!estado?.disponible || !estado.anticipo) return null
  const delEnvio = estado.anticipo.base === 'envio'
  if (compacto) {
    return (
      <span className="block text-xs text-gray-600">
        Hoy pagas <strong className="text-gray-900">{fmt(estado.anticipo.monto)}</strong> · al recibir {fmt(estado.alRecibir)}
      </span>
    )
  }
  return (
    <div className="mt-3 rounded-lg bg-orange-50 p-3 text-sm">
      <div className="flex justify-between font-semibold text-gray-900"><span>Pagas hoy{delEnvio ? ' (el envío)' : ''}</span><span>{fmt(estado.anticipo.monto)}</span></div>
      <div className="mt-1 flex justify-between text-gray-700"><span>Pagas al recibir</span><span>{fmt(estado.alRecibir)}</span></div>
    </div>
  )
}

/** Texto del botón de pagar: «Pagar anticipo $ 9.000 [con Wompi]» o `null` (el de siempre). */
export function textoBotonAnticipo(estado: EstadoContraentrega | null, pasarela: string | null, fmt: (n: number) => string): string | null {
  if (!estado?.disponible || !estado.anticipo) return null
  const nombre = estado.pasarelas.length > 1 ? estado.pasarelas.find((p) => p.codigo === pasarela)?.nombre ?? null : null
  return `Pagar anticipo ${fmt(estado.anticipo.monto)}${nombre ? ` con ${nombre}` : ''}`
}
