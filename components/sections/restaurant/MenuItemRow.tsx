'use client'

/**
 * Plato de la carta completa (Figma MenuItemRow 132:272).
 *
 * - layout: `list` (sin foto) | `photo` (miniatura de 72 px).
 * - state:  `default` | `sold_out` (stock de la sede) | `unavailable` (carta
 *   fuera de horario). `featured` (destacado del chef) no se implementa: el
 *   dato no existe en la base.
 * - size:   `regular` («Agregar» a la derecha) | `compact` (el nombre se ajusta
 *   y «Agregar» va debajo) | `auto` (compact en móvil, regular desde md).
 *
 * Colores: tokens del tema (foreground, muted, border) + variables de la
 * organización (--accent-color). Nada fijo salvo el ámbar de estado, que el
 * sitio no tiene como token.
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Clock, ImageIcon } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'
import { isOptimizableImage } from '@/lib/restaurant/secciones'
import { cn } from '@/lib/utils'
import type { MenuItem } from '@/lib/menu/menuFull'

export type MenuItemLayout = 'list' | 'photo'
export type MenuItemSize = 'regular' | 'compact' | 'auto'
export type MenuItemState = 'default' | 'sold_out' | 'unavailable'

interface MenuItemRowProps {
  item: MenuItem
  layout: MenuItemLayout
  size: MenuItemSize
  state: MenuItemState
  /** «Disponible desde las HH:MM» cuando state = unavailable. */
  availableFrom?: string | null
  showDescription: boolean
  /** Pedido en línea activo en el sitio: solo entonces hay «Agregar». */
  canOrder: boolean
  onAdd: (item: MenuItem) => void
}

const ACCENT = 'var(--accent-color, var(--primary-color))'

function AddButton({
  item,
  disabled,
  onAdd,
  className,
}: {
  item: MenuItem
  disabled: boolean
  onAdd: (item: MenuItem) => void
  className?: string
}) {
  const [added, setAdded] = useState(false)
  const base =
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm leading-5 transition-colors'

  // Padre con variantes: se elige talla/presentación en el detalle, igual que
  // en las tarjetas de producto (agregar un padre deja pedidos sin variante).
  if (item.hasVariants) {
    return (
      <Link
        href={`/productos/${item.uuid}`}
        className={cn(base, 'hover:bg-muted', disabled && 'pointer-events-none opacity-50', className)}
        style={{ borderColor: ACCENT, color: ACCENT }}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
      >
        Elegir
      </Link>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onAdd(item)
        setAdded(true)
        setTimeout(() => setAdded(false), 1500)
      }}
      className={cn(base, 'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50', className)}
      style={{ borderColor: ACCENT, color: ACCENT }}
      aria-label={`Agregar ${item.name} al pedido`}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          Listo
        </>
      ) : (
        'Agregar'
      )}
    </button>
  )
}

export function MenuItemRow({
  item,
  layout,
  size,
  state,
  availableFrom,
  showDescription,
  canOrder,
  onAdd,
}: MenuItemRowProps) {
  const muted = state !== 'default'
  const addDisabled = state !== 'default'
  // Lienzo del editor: el plato lleva su id para abrir el constructor de la carta.
  const enLienzo = useIsPreviewMode()
  const compact = size === 'compact'
  const auto = size === 'auto'

  return (
    <div
      className="flex w-full items-start gap-4 border-b border-border py-4"
      data-goadmin-producto={enLienzo ? item.id : undefined}
    >
      {layout === 'photo' && (
        <div
          className={cn(
            'relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted',
            muted && 'opacity-50',
          )}
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="72px"
              className="object-cover"
              // Foto propia de la carta: puede venir de otro dominio (no optimizable).
              unoptimized={!isOptimizableImage(item.imageUrl)}
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        {/* Línea: nombre · guía de puntos · precio */}
        <div className={cn('flex w-full gap-2', compact ? 'items-end' : auto ? 'items-end md:items-center' : 'items-center')}>
          <h3
            className={cn(
              'text-lg font-bold leading-7 md:text-xl [font-family:var(--font-heading)]',
              muted ? 'text-muted-foreground/70' : 'text-foreground',
              compact ? 'min-w-0 flex-1' : auto ? 'min-w-0 flex-1 md:flex-none md:truncate' : 'min-w-0 truncate',
            )}
          >
            {item.name}
          </h3>
          {item.featured && (
            <span
              className="shrink-0 self-center rounded-full px-2 py-0.5 text-xs font-medium leading-4 text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Destacado
            </span>
          )}
          <span
            aria-hidden="true"
            className={cn(
              'mb-[7px] border-b border-dotted border-border',
              compact ? 'w-6 shrink-0' : auto ? 'w-6 shrink-0 md:w-auto md:min-w-4 md:flex-1' : 'min-w-4 flex-1',
            )}
          />
          <span
            className={cn('whitespace-nowrap text-base font-medium leading-6', muted && 'text-muted-foreground/70')}
            style={muted ? undefined : { color: ACCENT }}
          >
            {item.price !== null && <Price value={item.price} />}
          </span>
        </div>

        {showDescription && item.description && (
          <p
            className={cn(
              'text-sm leading-5',
              muted ? 'text-muted-foreground/70' : 'text-muted-foreground',
            )}
          >
            {item.description}
          </p>
        )}

        {state === 'sold_out' && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium leading-4 text-muted-foreground">
              Agotado
            </span>
          </div>
        )}

        {state === 'unavailable' && availableFrom && (
          <div className="flex items-center gap-2 text-xs font-medium leading-4 text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Disponible desde las {availableFrom}
          </div>
        )}

        {canOrder && (compact || auto) && (
          <AddButton item={item} disabled={addDisabled} onAdd={onAdd} className={auto ? 'md:hidden' : undefined} />
        )}
      </div>

      {canOrder && !compact && (
        <AddButton item={item} disabled={addDisabled} onAdd={onAdd} className={auto ? 'hidden md:inline-flex' : undefined} />
      )}
    </div>
  )
}
