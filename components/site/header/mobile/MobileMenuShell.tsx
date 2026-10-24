'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { EstiloMenuMovil, PanelMenu } from '@/lib/website/menuMovil'

const PANEL_BASE: PanelMenu = {
  width: 85,
  background: 'color',
  overlay: 50,
  animation: 'slide',
  showLogo: false,
  showSearch: false,
  showSocial: false,
  showContact: false,
  categories: 'accordion',
}

/**
 * Cajón, hoja, cortina o pantalla del menú móvil. Solo se monta cuando la sección
 * pidió un estilo o un panel nuevo. La variante de hoy no pasa por aquí.
 */
export function MobileMenuShell({
  abierto,
  onCerrar,
  estilo,
  panel,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  estilo: EstiloMenuMovil
  panel: PanelMenu | null
  children: ReactNode
}) {
  const [montado, setMontado] = useState(false)
  const [activo, setActivo] = useState(false)
  const p = panel ?? PANEL_BASE

  useEffect(() => {
    if (abierto) {
      setMontado(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setActivo(true)))
      return () => cancelAnimationFrame(id)
    }
    setActivo(false)
    const t = window.setTimeout(() => setMontado(false), 280)
    return () => window.clearTimeout(t)
  }, [abierto])

  useEffect(() => {
    if (!montado) return
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previo }
  }, [montado])

  if (estilo === 'none' || estilo === 'tabs' || !montado) return null

  const lado = estilo === 'drawer_left' ? 'left' : estilo === 'bottom_sheet' ? 'bottom' : estilo === 'top_dropdown' ? 'top' : estilo === 'fullscreen' ? 'full' : 'right'
  const ancho = lado === 'left' || lado === 'right'
  const transformCerrado = p.animation === 'fade'
    ? 'none'
    : p.animation === 'scale'
      ? 'scale(0.96)'
      : lado === 'left' ? 'translateX(-100%)' : lado === 'bottom' ? 'translateY(100%)' : lado === 'top' ? 'translateY(-100%)' : lado === 'full' ? 'none' : 'translateX(100%)'

  const caja: CSSProperties = {
    transition: 'transform 280ms ease, opacity 280ms ease',
    transform: activo ? 'none' : transformCerrado,
    opacity: p.animation === 'fade' || p.animation === 'scale' ? (activo ? 1 : 0) : 1,
    ...fondo(p),
  }
  if (ancho) caja.width = `${p.width}%`
  if (lado === 'bottom') caja.maxHeight = '88%'
  if (lado === 'top') caja.maxHeight = '70%'

  const ancla = lado === 'left' ? 'left-0 top-0 h-full'
    : lado === 'bottom' ? 'inset-x-0 bottom-0 rounded-t-3xl'
    : lado === 'top' ? 'inset-x-0 top-0 rounded-b-3xl'
    : lado === 'full' ? 'inset-0'
    : 'right-0 top-0 h-full'

  return (
    <div className="fixed inset-0 z-[60]" data-menu-shell={estilo} data-menu-animacion={p.animation}>
      <button
        type="button"
        aria-label="Cerrar menú"
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${(activo ? p.overlay : 0) / 100})`, transition: 'background-color 280ms ease' }}
        onClick={onCerrar}
      />
      <div className={`absolute flex flex-col shadow-2xl ${ancla}`} style={caja}>
        {lado === 'bottom' && <span className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-300" aria-hidden="true" />}
        {children}
      </div>
    </div>
  )
}

function fondo(panel: PanelMenu): CSSProperties {
  if (panel.background === 'gradient' && panel.gradient1 && panel.gradient2) {
    return { backgroundImage: `linear-gradient(180deg, ${panel.gradient1}, ${panel.gradient2})` }
  }
  if (panel.background === 'blur') {
    return { backgroundColor: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(16px)' }
  }
  return { backgroundColor: panel.color || 'var(--background-color, #ffffff)' }
}
