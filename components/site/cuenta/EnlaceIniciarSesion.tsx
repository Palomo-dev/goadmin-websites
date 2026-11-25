'use client'

/**
 * «Iniciar sesión» de cualquier punto de la tienda que no es el ícono de cuenta ni el menú:
 * favoritos (página y panel), consultar pedido, reseñas «solo compradores», precios por volumen y
 * Mi cuenta. UNA regla con el ícono de la cabecera (reglaAcceso.ts): abre el acceso con el modo
 * elegido en el editor (página, diálogo, cajón o ventana → hoja en el celular) y, al entrar, vuelve
 * a donde estaba.
 *
 * Es un enlace de verdad a /auth?siguiente=<esta página>: sin acceso montado (modo «Página»,
 * cuenta congelada) o con Ctrl/⌘/clic central, navega ahí, y la página de acceso devuelve aquí.
 * Con el acceso montado se abre encima de lo que haya (el panel de favoritos, la ventana de la
 * reseña): esos cierran con Escape solo si el acceso no la usó (`e.defaultPrevented`).
 */
import type { CSSProperties, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from '@/components/site/Enlace'
import { alTocarIniciarSesion, hayAccesoMontado } from './eventos'
import { rutaIniciarSesion } from './reglaAcceso'

export function EnlaceIniciarSesion({
  volverA,
  alNavegar,
  className,
  style,
  ariaLabel,
  children,
}: {
  /** A dónde volver al entrar por la página. Sin valor, esta misma página. */
  volverA?: string
  /**
   * Solo si el enlace navega a la página (sin acceso montado): lo que hay que cerrar (el panel de
   * favoritos). Con el acceso montado, este se abre ENCIMA y, al entrar, todo sigue donde estaba.
   */
  alNavegar?: () => void
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  children: ReactNode
}) {
  const ruta = usePathname()
  const href = rutaIniciarSesion(volverA ?? ruta)
  return (
    <Link
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
      data-iniciar-sesion=""
      onClick={(e) => {
        if (alNavegar && !hayAccesoMontado()) alNavegar()
        alTocarIniciarSesion(e, href)
      }}
    >
      {children}
    </Link>
  )
}
