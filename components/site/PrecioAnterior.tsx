import type { ReactNode } from 'react'

/**
 * Precio anterior tachado, junto al precio actual. Misma pieza que la tarjeta de producto
 * (gris 400 y tachado, un paso de texto menor que el precio), con `<s>` y una etiqueta para
 * lectores de pantalla: «Precio anterior: …». El tachado solo no se lee.
 */
export function PrecioAnterior({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <s className={`text-gray-400 dark:text-gray-500 font-normal ${className}`} data-precio-anterior="">
      <span className="sr-only">Precio anterior: </span>
      {children}
    </s>
  )
}
