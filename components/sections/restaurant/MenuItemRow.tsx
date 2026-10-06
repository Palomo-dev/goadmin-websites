'use client'

/**
 * Plato de la carta completa (Figma MenuItemRow 132:272).
 *
 * - layout: `list` (sin foto) | `photo` (miniatura de 72 px).
 * - state:  `default` | `sold_out` (stock o carta de la sede; «Vuelve a las
 *   HH:MM» si la sede fijó hasta cuándo) | `unavailable` (carta fuera de
 *   horario: «Disponible desde…» / «Disponible mañana desde…»).
 * - Etiquetas del ERP (product_tags) como chips con su color, máx. 3.
 * - La foto y el nombre abren la hoja del plato (`onOpen`); un plato con
 *   variantes o con grupo obligatorio dice «Elegir» y también abre la hoja.
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
import { soldOutReturnLabel, type MenuItem } from '@/lib/menu/menuFull'

export type MenuItemLayout = 'list' | 'photo'
export type MenuItemSize = 'regular' | 'compact' | 'auto'
export type MenuItemState = 'default' | 'sold_out' | 'unavailable'

interface MenuItemRowProps {
  item: MenuItem
  layout: MenuItemLayout
  size: MenuItemSize
  state: MenuItemState
  /** Texto completo cuando state = unavailable («Disponible desde las 12:00»). */
  availableLabel?: string | null
  showDescription: boolean
  /** Pedido en línea activo en el sitio: solo entonces hay «Agregar». */
  canOrder: boolean
  onAdd: (item: MenuItem) => void
  /** Abre la hoja del plato. Sin él, «Elegir» enlaza al detalle como antes. */
  onOpen?: (item: MenuItem) => void
  /** Zona de la organización para «Vuelve a las HH:MM». */
  timeZone?: string
}

const ACCENT = 'var(--accent-color, var(--primary-color))'

function AddButton({
  item,
  disabled,
  onAdd,
  onOpen,
  className,
}: {
  item: MenuItem
  disabled: boolean
  onAdd: (item: MenuItem) => void
  onOpen?: (item: MenuItem) => void
  className?: string
}) {
  const [added, setAdded] = useState(false)
  const base =
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm leading-5 transition-colors'

  // Padre con variantes o plato con grupo obligatorio: se elige en la hoja del
  // plato (o en el detalle). Agregarlo directo deja pedidos sin variante o sin
  // acompañante, que el servidor rechaza.
  const elegir = item.hasVariants || item.requiresChoice
  if (elegir && onOpen) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpen(item)}
        className={cn(base, 'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50', className)}
        style={{ borderColor: ACCENT, color: ACCENT }}
        aria-label={`Elegir opciones de ${item.name}`}
        aria-haspopup="dialog"
      >
        Elegir
      </button>
    )
  }
  if (elegir) {
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
  availableLabel,
  showDescription,
  canOrder,
  onAdd,
  onOpen,
  timeZone,
}: MenuItemRowProps) {
  const muted = state !== 'default'
  const addDisabled = state !== 'default'
  // Lienzo del editor: el plato lleva su id para abrir el constructor de la carta.
  const enLienzo = useIsPreviewMode()
  const compact = size === 'compact'
  const auto = size === 'auto'
  const vuelve = state === 'sold_out' ? soldOutReturnLabel(item.soldOutUntil, timeZone || 'America/Bogota') : null
  const abrir = onOpen ? () => onOpen(item) : undefined

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
            abrir && 'cursor-pointer',
          )}
          onClick={abrir}
          aria-hidden={abrir ? 'true' : undefined}
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
            {abrir ? (
              <button
                type="button"
                onClick={abrir}
                aria-haspopup="dialog"
                className="text-left hover:underline focus-visible:underline focus-visible:outline-none [text-decoration-color:var(--accent-color,var(--primary-color))]"
              >
                {item.name}
              </button>
            ) : (
              item.name
            )}
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

        {item.tags.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Etiquetas">
            {item.tags.map((t) => (
              <li
                key={t.id}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs font-medium leading-4',
                  !t.color && 'border-border bg-muted text-muted-foreground',
                  muted && 'opacity-70',
                )}
                // Color del ERP como borde y texto sobre fondo neutro: legible en claro y oscuro.
                style={t.color ? { borderColor: t.color, color: t.color } : undefined}
              >
                {t.name}
              </li>
            ))}
          </ul>
        )}

        {state === 'sold_out' && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium leading-4 text-muted-foreground">
              Agotado
            </span>
            {vuelve && <span className="text-xs leading-4 text-muted-foreground">{vuelve}</span>}
          </div>
        )}

        {state === 'unavailable' && availableLabel && (
          <div className="flex items-center gap-2 text-xs font-medium leading-4 text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {availableLabel}
          </div>
        )}

        {canOrder && (compact || auto) && (
          <AddButton item={item} disabled={addDisabled} onAdd={onAdd} onOpen={onOpen} className={auto ? 'md:hidden' : undefined} />
        )}
      </div>

      {canOrder && !compact && (
        <AddButton item={item} disabled={addDisabled} onAdd={onAdd} onOpen={onOpen} className={auto ? 'hidden md:inline-flex' : undefined} />
      )}
    </div>
  )
}
