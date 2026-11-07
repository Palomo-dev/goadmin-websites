'use client'

/**
 * Cupón copiable de un banner promocional (`banners[].coupon_code` + `banners[].valid_until`,
 * plantillas Panorama y Hogar; PLANO §3).
 *
 * El código lo escribe el dueño (nunca uno de ejemplo) y lo normaliza el contrato
 * (`normalizarCuponBanner`: A-Z, 0-9, `-` y `_`). Copiarlo no aplica nada: el visitante lo pega en
 * el campo de cupón de siempre del checkout, que es quien lo valida. Vencido (`valid_until` antes
 * de hoy en la zona de la organización), el cupón no se pinta y el banner sí.
 */
import { useEffect, useRef, useState } from 'react'
import { Clock, Ticket } from 'lucide-react'
import type { CuponBanner as Cupon } from '@/lib/website/v2/contrato/seccionesTienda'
import { textoVigencia } from '@/lib/website/portadaTienda'

/** Copia al portapapeles; sin la API (http o navegador viejo), con un campo temporal. */
async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // Sigue con el respaldo.
  }
  try {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.setAttribute('readonly', '')
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(campo)
    return ok
  } catch {
    return false
  }
}

/** Chip «Válido hasta el 31 dic. 2026». Sin fecha, nada. */
export function VigenciaCupon({ cupon, className = '' }: { cupon: Cupon; className?: string }) {
  const texto = cupon.validUntil ? textoVigencia(cupon.validUntil) : null
  if (!texto) return null
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur ${className}`}>
      <Clock className="h-3 w-3" aria-hidden="true" />
      {texto}
    </span>
  )
}

/** Píldora con el código y «Copiar». Es un botón propio: el banner con cupón no va envuelto en un enlace. */
export function CuponCopiable({ cupon, className = '' }: { cupon: Cupon; className?: string }) {
  const [estado, setEstado] = useState<'listo' | 'copiado' | 'error'>('listo')
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (reloj.current) clearTimeout(reloj.current)
  }, [])
  const alPulsar = async () => {
    const ok = await copiar(cupon.code)
    setEstado(ok ? 'copiado' : 'error')
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = setTimeout(() => setEstado('listo'), 2200)
  }
  return (
    <span className={`inline-flex w-fit flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={alPulsar}
        aria-label={`Copiar el cupón ${cupon.code}`}
        className="inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-1.5 text-gray-900 shadow-sm transition-transform hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
        data-cupon-banner=""
      >
        <Ticket className="h-4 w-4" aria-hidden="true" />
        <span className="font-mono text-sm font-semibold tracking-wide">{cupon.code}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium">{estado === 'copiado' ? 'Copiado' : 'Copiar'}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {estado === 'copiado' ? `Cupón ${cupon.code} copiado` : estado === 'error' ? `No se pudo copiar. El cupón es ${cupon.code}` : ''}
      </span>
      {estado === 'error' && <span className="text-[11px] opacity-90">Cópialo a mano: {cupon.code}</span>}
    </span>
  )
}
