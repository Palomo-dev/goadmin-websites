'use client'

/**
 * «Sigue tu pedido» (Figma «16 Sitio web» 2975:72068): pestañas «Número de pedido» y «Guía de
 * transportadora». Con el número, el correo o teléfono de la compra abre la página del pedido con
 * su token (lo decide /api/cuenta/buscar-pedido en el servidor). Con la guía, la búsqueda de
 * siempre (`?guia=`), que pinta la página en el servidor.
 */
import { useState, type ReactNode } from 'react'
import { Loader2, Mail, MessageSquare, Package, Search, Truck } from 'lucide-react'
import { abrirAccesoCuenta } from '@/components/site/cuenta/eventos'
import { useAvatarCuenta } from '@/components/site/cuenta/avatar/datosAvatar'
import Link from '@/components/site/Enlace'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { NO_ENCONTRADO_SIN_CUENTA, normalizarNumeroPedido, tipoContacto } from '@/lib/cuenta/reglasCuenta'

const CAMPO =
  'h-12 w-full rounded-[10px] border border-slate-300 bg-white pl-10 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]'

export function SeguirPedido({
  modoInicial,
  guiaInicial,
  whatsapp,
  children,
}: {
  modoInicial: 'pedido' | 'guia'
  guiaInicial: string
  whatsapp: string | null
  children?: ReactNode
}) {
  const [modo, setModo] = useState<'pedido' | 'guia'>(modoInicial)
  const { sesion } = useAvatarCuenta()
  const { ruta } = useRutaSitio()
  const [numero, setNumero] = useState('')
  const [contacto, setContacto] = useState('')
  const [guia, setGuia] = useState(guiaInicial)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!normalizarNumeroPedido(numero) || !tipoContacto(contacto)) {
      setError('Escribe el número del pedido y el correo o teléfono con el que compraste.')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/cuenta/buscar-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, contacto }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.ruta === 'string' && data.ruta.startsWith('/pedido/')) {
        window.location.href = data.ruta
        return
      }
      setError(data.error || NO_ENCONTRADO_SIN_CUENTA)
    } catch {
      setError('No pudimos buscar tu pedido. Revisa tu conexión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 text-slate-900" data-seguir-pedido="">
      <h1 className="text-2xl font-semibold leading-snug">Sigue tu pedido</h1>
      <p className="text-[15px] leading-snug text-slate-600">No necesitas cuenta. Usa los datos de tu correo de confirmación.</p>

      <div role="tablist" aria-label="Cómo buscar" className="flex rounded-[10px] bg-slate-100 p-1">
        {(
          [
            ['pedido', 'Número de pedido'],
            ['guia', 'Guía de transportadora'],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={modo === clave}
            onClick={() => {
              setModo(clave)
              setError(null)
            }}
            className={`flex-1 rounded-lg py-2 text-[13px] transition-colors ${modo === clave ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'font-medium text-slate-600 hover:text-slate-900'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {modo === 'pedido' ? (
        <form onSubmit={buscar} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rastrear-numero" className="text-[13px] font-medium">Número de pedido</label>
            <div className="relative">
              <Package aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="rastrear-numero" className={`${CAMPO} uppercase`} autoComplete="off" placeholder="WO-000412" value={numero} onChange={(e) => setNumero(e.target.value)} disabled={enviando} aria-describedby="rastrear-numero-ayuda" />
            </div>
            <p id="rastrear-numero-ayuda" className="text-xs text-slate-600">Está en el correo y en el WhatsApp de confirmación.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rastrear-contacto" className="text-[13px] font-medium">Correo o teléfono de la compra</label>
            <div className="relative">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="rastrear-contacto" className={CAMPO} autoComplete="email" placeholder="tu@correo.com" value={contacto} onChange={(e) => setContacto(e.target.value)} disabled={enviando} aria-describedby="rastrear-contacto-ayuda" />
            </div>
            <p id="rastrear-contacto-ayuda" className="text-xs text-slate-600">Para que solo tú veas la dirección y los datos de la entrega.</p>
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="flex h-12 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            {enviando ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
            {enviando ? 'Buscando…' : 'Ver mi pedido'}
          </button>
        </form>
      ) : (
        <>
          <form method="GET" action="/rastrear" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rastrear-guia" className="text-[13px] font-medium">Número de guía</label>
              <div className="relative">
                <Truck aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="rastrear-guia" name="guia" required className={CAMPO} placeholder="Ej.: TRK-ABC123" value={guia} onChange={(e) => setGuia(e.target.value)} />
              </div>
              <p className="text-xs text-slate-600">La guía que te dio la transportadora.</p>
            </div>
            <button
              type="submit"
              className="flex h-12 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Rastrear envío
            </button>
          </form>
          {children}
        </>
      )}

      {/* Con sesión no se invita a «Ingresar»: se lleva a sus pedidos (la misma fuente de sesión que
          el avatar de la cabecera). Mientras no se sabe (null), no se pinta nada. */}
      {sesion === true ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-sm font-semibold">Ya iniciaste sesión</p>
          <p className="text-[13px] text-slate-600">Todos tus pedidos están en Mi cuenta, sin buscar el número.</p>
          <Link
            href={ruta('/mi-cuenta/pedidos')}
            className="self-center text-sm font-semibold hover:underline"
            style={{ color: 'var(--primary-color)' }}
          >
            Ver mis pedidos →
          </Link>
        </div>
      ) : sesion === false ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-sm font-semibold">¿Tienes cuenta?</p>
          <p className="text-[13px] text-slate-600">Entra y verás todos tus pedidos, sin buscar el número.</p>
          <button
            type="button"
            onClick={(e) => abrirAccesoCuenta({ origen: e.currentTarget, respaldo: '/auth?siguiente=/mi-cuenta/pedidos' })}
            className="self-center text-sm font-semibold hover:underline"
            style={{ color: 'var(--primary-color)' }}
          >
            Ingresar →
          </button>
        </div>
      ) : null}

      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm font-medium hover:underline" style={{ color: 'var(--primary-color)' }}>
          <MessageSquare aria-hidden="true" className="h-4 w-4" />
          ¿No lo encuentras? Escríbenos por WhatsApp
        </a>
      )}
    </div>
  )
}
