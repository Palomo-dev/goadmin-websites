/**
 * Estado vacío de Mi cuenta (Figma «16 Sitio web» 3051:80110, pantalla 10): ícono en un círculo
 * con el tono de la tienda, título, una frase que explica qué aparecerá y, si aplica, el botón para
 * empezar («Ver productos», «Agregar dirección»…). En vez de un «0».
 */
import Link from '@/components/site/Enlace'
import type { LucideIcon } from 'lucide-react'

export interface EstadoVacioCuentaProps {
  icono: LucideIcon
  titulo: string
  texto: string
  /** Botón con enlace. */
  accion?: { texto: string; href: string } | null
  /** Botón que hace algo en la página (p. ej. abrir el formulario de dirección). */
  alPulsar?: { texto: string; onClick: () => void } | null
  className?: string
}

export function EstadoVacioCuenta({ icono: Icono, titulo, texto, accion, alPulsar, className = '' }: EstadoVacioCuentaProps) {
  const claseBoton = 'mt-1 inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90'
  return (
    <div className={`flex flex-col items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-6 py-8 text-center ${className}`} data-estado-vacio-cuenta="">
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 12%, white)' }} aria-hidden="true">
        <Icono className="h-6 w-6" style={{ color: 'var(--primary-color)' }} strokeWidth={1.75} />
      </span>
      <p className="text-base font-semibold text-slate-900">{titulo}</p>
      <p className="max-w-[300px] text-sm leading-relaxed text-slate-600">{texto}</p>
      {accion ? (
        <Link href={accion.href} className={claseBoton} style={{ backgroundColor: 'var(--primary-color)' }}>
          {accion.texto}
        </Link>
      ) : alPulsar ? (
        <button type="button" onClick={alPulsar.onClick} className={claseBoton} style={{ backgroundColor: 'var(--primary-color)' }}>
          {alPulsar.texto}
        </button>
      ) : null}
    </div>
  )
}
