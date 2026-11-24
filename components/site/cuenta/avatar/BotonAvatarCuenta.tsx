'use client'

/**
 * Ícono de cuenta con sesión (Figma «16 Sitio web» 3044:78726, pantallas 4–6, aprobado
 * 2026-11-24): el avatar con las iniciales en el color de la tienda reemplaza al glifo de cuenta y,
 * al tocarlo, abre su menú (desplegable en el computador, hoja inferior en el celular) en
 * CUALQUIER modo de `header_cuenta.modo`, también «Página». Sin sesión no se usa: el ícono de
 * siempre sigue abriendo el acceso como hoy (EnlaceCuenta).
 *
 * Cada botón lleva su propio menú (no depende de AccesoCuenta, que con «Página» ni se monta).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AvatarCuenta } from './AvatarCuenta'
import { useAvatarCuenta } from './datosAvatar'
import { MenuAvatar } from './MenuAvatar'

/** El menú del botón que envuelve al avatar está abierto (aro translúcido). */
const MenuAvatarAbierto = createContext(false)

/**
 * El avatar de la cabecera: iniciales de la ficha (o las provisionales de la sesión mientras
 * llegan), punto verde con pedido en curso y aro mientras su menú está abierto.
 */
export function AvatarCabecera({ primaryColor, tam = 32, className }: { primaryColor?: string | null; tam?: number; className?: string }) {
  const { datos, inicialesProvisionales } = useAvatarCuenta()
  const abierto = useContext(MenuAvatarAbierto)
  const iniciales = datos?.identidad.iniciales || inicialesProvisionales || '?'
  return <AvatarCuenta iniciales={iniciales} primaryColor={primaryColor} tam={tam} enCurso={!!datos?.enCurso} abierto={abierto} className={className} />
}

export interface BotonAvatarCuentaProps {
  primaryColor?: string | null
  /** `website_settings.whatsapp_number`: sin número no sale «Ayuda por WhatsApp». */
  whatsapp?: string | null
  className?: string
  title?: string
  /** Presentación propia (estilos con texto «Hola, Laura»); sin ella, el avatar de 32 px. */
  children?: ReactNode
}

export function BotonAvatarCuenta({ primaryColor, whatsapp, className, title, children }: BotonAvatarCuentaProps) {
  const { datos, correoSesion } = useAvatarCuenta()
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const cerrar = useCallback(() => setAbierto(false), [])
  const quien = datos?.identidad.nombre || datos?.identidad.correo || correoSesion
  return (
    <MenuAvatarAbierto.Provider value={abierto}>
      <button
        ref={boton}
        type="button"
        className={`${className ?? ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1`}
        title={title}
        aria-label={quien ? `Mi cuenta, ${quien}` : 'Mi cuenta'}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        data-avatar-boton=""
        onClick={() => setAbierto(true)}
      >
        {children ?? <AvatarCabecera primaryColor={primaryColor} />}
      </button>
      {abierto && <MenuAvatar origen={boton.current} primaryColor={primaryColor} whatsapp={whatsapp} onCerrar={cerrar} />}
    </MenuAvatarAbierto.Provider>
  )
}

/**
 * Para cabeceras que no pasan por EnlaceCuenta (el constructor por zonas): con sesión, el botón
 * del avatar con su menú; sin sesión (o mientras no se sabe), lo de hoy tal cual.
 */
export function CuentaConAvatar({ primaryColor, whatsapp, className, children }: Omit<BotonAvatarCuentaProps, 'children' | 'title'> & { children: ReactNode }) {
  const { sesion } = useAvatarCuenta()
  if (!sesion) return <>{children}</>
  return <BotonAvatarCuenta primaryColor={primaryColor} whatsapp={whatsapp} className={className ?? 'inline-flex rounded-full p-1'} />
}
