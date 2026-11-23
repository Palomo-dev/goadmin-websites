'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingCart, type LucideIcon } from 'lucide-react'
import { contarUnidadesCarrito } from '@/lib/cart'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { IconoConCirculo, propsTrazoIcono } from './header/IconoEncabezado'
import { ContenedorIcono, trazoContenedor, type ColoresCaja } from './header/ContenedorIcono'
import { contenedorDe, type ContenedorIconos } from '@/lib/website/constructorEncabezado'
import { AccionCabecera, InsigniaContador, claseColorIcono, claseEnvoltorio, estiloGlifo, estiloPropio, type PresentacionIcono } from './header/AccionCabecera'

interface CartIndicatorProps {
  primaryColor: string
  /** 'drawer' abre el drawer lateral (default), 'redirect' navega a /checkout */
  cartBehavior?: 'drawer' | 'redirect'
  onClick?: () => void
  organizationSubdomain?: string
  /** Icono personalizado (del editor). Default: ShoppingCart */
  icon?: LucideIcon
  branchId?: number | null
  /** El ícono hereda `--header-fg` de la barra. */
  heredarColor?: boolean
  /** Relleno del icono (el trazo se queda). */
  relleno?: boolean
  /** Círculo del color de la marca detrás del icono. */
  circulo?: boolean
  /** Caja nueva. Sin ella se conserva el círculo de acento. */
  contenedor?: ContenedorIconos | null
  colores?: ColoresCaja
  /** Clase del ícono. En el celular, `--hdr-mobile-icon`. */
  claseIcono?: string
  /**
   * Opciones nuevas de la cabecera (`header_iconos`): estilo, texto, tamaño, trazo y contador.
   * Sin ellas (`null`), el ícono y el contador de hoy, sin ningún cambio.
   */
  presentacion?: PresentacionIcono | null
}

/* `data-icono-carrito`: destino de «Vuela al carrito» de la barra fija (components/site/barraFija). */
export function CartIndicator({ primaryColor, cartBehavior = 'drawer', onClick, organizationSubdomain, icon: IconProp, branchId, heredarColor = false, relleno = false, circulo = false, contenedor = null, colores, claseIcono, presentacion = null }: CartIndicatorProps) {
  const { ruta } = useRutaSitio()
  const Icon = IconProp || ShoppingCart
  const trazo = propsTrazoIcono(relleno)
  const clase = claseIcono ?? (circulo || heredarColor ? 'h-6 w-6 text-current' : 'h-6 w-6 text-gray-700 dark:text-gray-300')
  const caja = contenedor ? contenedorDe(contenedor, 'cart') : null
  // Tamaño y trazo nuevos (si los hay) pisan los de hoy; sin `presentacion`, el estilo vacío no cambia nada.
  const glifo = presentacion ? estiloGlifo(presentacion) : undefined
  const icono = caja ? (
    <ContenedorIcono base={contenedor!} clave="cart" colores={colores || { primary: primaryColor, accent: primaryColor, secondary: primaryColor }}>
      <Icon style={presentacion ? estiloGlifo(presentacion, trazoContenedor(contenedor!, 'cart', relleno)) : trazoContenedor(contenedor!, 'cart', relleno)} />
    </ContenedorIcono>
  ) : (
    <IconoConCirculo circulo={circulo} primaryColor={primaryColor}>
      <Icon className={clase} {...trazo} style={glifo} />
    </IconoConCirculo>
  )
  const [itemCount, setItemCount] = useState(0)
  
  useEffect(() => {
    const updateCount = () => {
      const subdomain = organizationSubdomain || window.location.hostname.split('.')[0]
      setItemCount(contarUnidadesCarrito(subdomain, branchId))
    }
    
    // Initial load
    updateCount()
    
    // Listen for cart updates
    window.addEventListener('cart-updated', updateCount)
    window.addEventListener('storage', updateCount)
    
    return () => {
      window.removeEventListener('cart-updated', updateCount)
      window.removeEventListener('storage', updateCount)
    }
  }, [organizationSubdomain, branchId])

  const pos = caja?.badgePosition
  const forma = caja?.badgeShape
  const claseBadge = forma || pos
    ? `absolute ${pos === 'top-left' ? '-top-1 -left-1' : '-top-1 -right-1'} ${forma === 'pill' ? 'h-5 min-w-5 rounded-full px-1.5' : 'w-5 h-5 rounded-full'} text-white text-xs font-bold flex items-center justify-center`
    : 'absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center'
  const badge = itemCount > 0 && (
    <span
      className={claseBadge}
      style={{ backgroundColor: caja?.badgeColor || primaryColor }}
    >
      {itemCount > 99 ? '99+' : itemCount}
    </span>
  )

  if (presentacion) {
    const propio = estiloPropio(presentacion.estilo)
    const colorContador = caja?.badgeColor || primaryColor
    const claseNumero = caja?.badgeShape === 'circle' ? 'w-5 h-5 rounded-full' : undefined
    const esquina = caja?.badgePosition === 'top-left' ? '-top-1 -left-1' : '-top-1 -right-1'
    const contador = <InsigniaContador cantidad={itemCount} contador={presentacion.contador} color={colorContador} className={propio ? '-top-2 -right-2' : esquina} claseNumero={claseNumero} />
    const contenido = propio ? (
      <AccionCabecera
        estilo={presentacion.estilo}
        texto={presentacion.texto}
        primaryColor={primaryColor}
        icono={<Icon className="shrink-0 text-current" {...trazo} style={estiloGlifo(presentacion, presentacion.px ? undefined : { width: 20, height: 20 })} />}
        insignia={contador}
      />
    ) : (
      <>
        {icono}
        {contador}
      </>
    )
    const etiqueta = presentacion.texto ? undefined : 'Carrito'
    // Color del texto y del ícono en los estilos nuevos: el de la barra (heredado o el del celular).
    const colorPropio = !propio || presentacion.estilo === 'relleno'
      ? ''
      : ` ${claseColorIcono(claseIcono, heredarColor)}`
    if (cartBehavior === 'redirect') {
      return (
        <Link href={ruta('/checkout')} aria-label={etiqueta} className={`${claseEnvoltorio(presentacion.estilo)}${colorPropio}`} data-icono-carrito="">
          {contenido}
        </Link>
      )
    }
    return (
      <button type="button" onClick={onClick} aria-label={etiqueta} className={`${claseEnvoltorio(presentacion.estilo)}${colorPropio}`} data-icono-carrito="">
        {contenido}
      </button>
    )
  }

  // Si el comportamiento es 'redirect', navegar directamente a /checkout
  if (cartBehavior === 'redirect') {
    return (
      <Link 
        href={ruta('/checkout')}
        className="relative p-2 rounded-full hover:bg-[var(--header-hover)] transition-colors"
        data-icono-carrito=""
      >
        {icono}
        {badge}
      </Link>
    )
  }

  // Por defecto: abrir el drawer
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-[var(--header-hover)] transition-colors"
      data-icono-carrito=""
    >
      {icono}
      {badge}
    </button>
  )
}
