'use client'

import { useState, type FormEvent } from 'react'

/**
 * Boletín en el pie de los sitios con tema (PieTema). Guarda el correo en /api/newsletter (la
 * organización la pone el servidor desde el dominio) y solo confirma si quedó guardado.
 */
export function BoletinPie({
  titulo,
  placeholder,
  textoBoton,
  primaryColor,
  textoSobrePrimario,
}: {
  titulo: string
  placeholder: string
  textoBoton: string
  primaryColor: string
  textoSobrePrimario: string
}) {
  const [correo, setCorreo] = useState('')
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'ok' | 'error'>('listo')
  const [mensaje, setMensaje] = useState('')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (estado === 'enviando') return
    const valor = correo.trim()
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(valor)) {
      setMensaje('Revisa el correo e inténtalo de nuevo.')
      setEstado('error')
      return
    }
    setEstado('enviando')
    try {
      const r = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: valor, source: 'footer' }),
      })
      if (r.ok) {
        setEstado('ok')
        setCorreo('')
        return
      }
      const datos = await r.json().catch(() => null)
      setMensaje(typeof datos?.error === 'string' ? datos.error : 'No pudimos guardar tu suscripción. Inténtalo de nuevo.')
      setEstado('error')
    } catch {
      setMensaje('No pudimos guardar tu suscripción. Inténtalo de nuevo.')
      setEstado('error')
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2" data-boletin-pie="" aria-label={titulo}>
      {/* Apilados: la columna del pie es angosta y en fila la caja del correo quedaba de 3 letras. */}
      <div className="flex flex-col gap-2">
        <input
          type="email"
          required
          name="email"
          autoComplete="email"
          aria-label="Correo"
          placeholder={placeholder}
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="w-full min-w-0 border border-current bg-transparent px-3 py-2 text-sm text-current placeholder:text-current placeholder:opacity-60 focus:outline-none focus:ring-2"
          style={{ borderRadius: 'var(--radio-boton, 6px)', ['--tw-ring-color' as string]: primaryColor }}
        />
        <button
          type="submit"
          disabled={estado === 'enviando'}
          aria-busy={estado === 'enviando' || undefined}
          className="w-full whitespace-nowrap border border-current px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: primaryColor, color: textoSobrePrimario, borderRadius: 'var(--radio-boton, 6px)' }}
        >
          {textoBoton}
        </button>
      </div>
      {estado === 'ok' && <p className="text-sm opacity-80" role="status">¡Listo! Te escribiremos con las novedades.</p>}
      {estado === 'error' && <p className="text-sm" role="alert">{mensaje}</p>}
    </form>
  )
}
