'use client'

/**
 * «Cuenta» de los menús inferiores con sesión (Figma «16 Sitio web» 3054:80142, aprobado
 * 2026-11-24): el avatar de 24 px con las iniciales en el color de la tienda en lugar del ícono de
 * persona, el punto verde con pedido en curso y, activo (en /mi-cuenta), un aro de 2 px del color
 * activo del menú. Al tocarlo se abre la hoja inferior del menú del avatar (pantalla 6), que tapa el
 * menú inferior mientras está abierta.
 *
 * La sesión y el pedido en curso salen del mismo almacén que el avatar de la cabecera
 * (`useAvatarCuenta`): el menú inferior no hace ninguna consulta propia.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { AvatarCuenta } from './AvatarCuenta'
import { useAvatarCuenta } from './datosAvatar'
import { MenuAvatar } from './MenuAvatar'

/** Lado del avatar en el menú inferior (componente «Menú inferior» 3053:80142). */
export const TAM_AVATAR_MENU_INFERIOR = 24

/**
 * El avatar del botón «Cuenta». El punto verde no depende del contador del menú (decisión del
 * dueño: se ve también con «Oculto»). `aro`: color del aro de activo (null = sin aro).
 */
export function AvatarMenuInferior({ primaryColor, tam = TAM_AVATAR_MENU_INFERIOR, aro, className = '' }: { primaryColor?: string | null; tam?: number; aro?: string | null; className?: string }) {
  const { datos, inicialesProvisionales } = useAvatarCuenta()
  const iniciales = datos?.identidad.iniciales || inicialesProvisionales || '?'
  return (
    <span
      className={`inline-flex shrink-0 rounded-full ${className}`}
      style={aro ? { outline: `2px solid ${aro}`, outlineOffset: 2 } : undefined}
      data-avatar-menu-inferior={aro ? 'activo' : ''}
    >
      <AvatarCuenta iniciales={iniciales} primaryColor={primaryColor} tam={tam} enCurso={!!datos?.enCurso} />
    </span>
  )
}

/** «Mi cuenta, Laura Pérez» (o el correo) para el aria-label del botón con el avatar. */
export function useEtiquetaCuenta(): string {
  const { datos, correoSesion } = useAvatarCuenta()
  const quien = datos?.identidad.nombre || datos?.identidad.correo || correoSesion
  return quien ? `Mi cuenta, ${quien}` : 'Mi cuenta'
}

/**
 * La hoja del menú del avatar para un menú inferior: `abrir(boton)` la muestra (el foco vuelve a ese
 * botón al cerrar) y `hoja` es lo que hay que pintar.
 */
export function useHojaCuentaMenu(primaryColor?: string | null, whatsapp?: string | null): { abierta: boolean; abrir: (origen: HTMLElement) => void; hoja: ReactNode } {
  const [origen, setOrigen] = useState<HTMLElement | null>(null)
  const cerrar = useCallback(() => setOrigen(null), [])
  const abrir = useCallback((el: HTMLElement) => setOrigen(el), [])
  const hoja = origen ? <MenuAvatar origen={origen} formato="hoja" primaryColor={primaryColor} whatsapp={whatsapp} onCerrar={cerrar} /> : null
  return { abierta: origen !== null, abrir, hoja }
}
