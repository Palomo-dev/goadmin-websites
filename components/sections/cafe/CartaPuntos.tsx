'use client'

/**
 * `menu_full` · «Línea de puntos» (plantilla «Café de especialidad», Figma 2223:46106 láminas 01,
 * 02 y 14).
 *
 * - Carta completa: selector de sede, pestañas por categoría (cursiva con subrayado, subrayado o
 *   píldora), contador («Café · 12 preparaciones») y dos columnas con línea de puntos hasta el precio.
 * - «Solo destacados» (la carta de Inicio): sin pestañas, contador ni selector; los destacados de
 *   «Editar la carta» (o los primeros platos) y el botón «Ver la carta completa».
 *
 * Los platos llegan ya resueltos del servidor (cafe/secciones.tsx): mismos datos que `menu_full`
 * (catálogo de la carta, cartas del ERP, orden, ocultos y destacados). Sin platos no se pinta nada.
 */

import { useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Price } from '@/components/site/CurrencyProvider'
import { BOTON_SECUNDARIO } from '@/lib/website/botonSitio'
import { textoPlano } from '@/lib/texto/textoPlano'
import { CLAVE_SEDE_RECORDADA, textoContador, type CartaPuntos as DatosCarta } from '@/lib/website/v2/contrato/seccionesCafe'

export interface PlatoCarta {
  id: number
  nombre: string
  descripcion: string | null
  precio: number
  precioAnterior: number | null
}

export interface CategoriaCarta {
  id: number
  nombre: string
  platos: PlatoCarta[]
}

export interface SedeCarta {
  id: number
  nombre: string
  /** Carta de esa sede (su sitio por ruta); `null` = la sede de esta página. */
  href: string | null
  actual: boolean
}

export interface CartaPuntosProps {
  carta: DatosCarta
  eyebrow: string | null
  titulo: string | null
  subtitulo: string | null
  categorias: CategoriaCarta[]
  /** Solo con «Solo destacados»: los platos ya elegidos. */
  destacados: PlatoCarta[]
  /** Selector de sede (ya filtrado con `selectorSedeVisible`); vacío = sin selector. */
  sedes: SedeCarta[]
}

const ACENTO = 'var(--accent-color, var(--primary-color))'

function Plato({ plato, carta }: { plato: PlatoCarta; carta: DatosCarta }) {
  const descripcion = carta.showDescription ? textoPlano(plato.descripcion) : ''
  const anterior = carta.showComparePrice && plato.precioAnterior !== null && plato.precioAnterior > plato.precio ? plato.precioAnterior : null
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex items-baseline gap-3">
        <h3 className="min-w-0 text-lg leading-snug text-foreground [font-family:var(--font-heading)] md:text-xl">{plato.nombre}</h3>
        <span
          aria-hidden="true"
          className={cn(
            'min-w-6 flex-1 translate-y-[-4px]',
            carta.leaderStyle === 'dots' && 'border-b-2 border-dotted border-current opacity-30',
            carta.leaderStyle === 'line' && 'border-b border-current opacity-25',
          )}
        />
        <span className="flex shrink-0 items-baseline gap-2 whitespace-nowrap [font-family:var(--font-heading)]">
          {anterior !== null && (
            <span className="text-sm text-muted-foreground line-through">
              <span className="sr-only">Antes </span>
              <Price value={anterior} />
            </span>
          )}
          <Price value={plato.precio} className="text-base text-foreground md:text-lg" />
        </span>
      </div>
      {descripcion && <p className="text-sm leading-6 text-muted-foreground">{descripcion}</p>}
    </li>
  )
}

function Platos({ platos, carta }: { platos: PlatoCarta[]; carta: DatosCarta }) {
  const columnas = carta.columns === 2 && platos.length > 1
  if (!columnas) {
    return (
      <ul className="mx-auto flex max-w-3xl flex-col">
        {platos.map((p) => (
          <Plato key={p.id} plato={p} carta={carta} />
        ))}
      </ul>
    )
  }
  // Dos columnas que se leen de arriba abajo (como la lámina): primera mitad a la izquierda.
  const mitad = Math.ceil(platos.length / 2)
  return (
    <div className="grid gap-x-16 md:grid-cols-2">
      {[platos.slice(0, mitad), platos.slice(mitad)].map((col, i) => (
        <ul key={i} className="flex flex-col">
          {col.map((p) => (
            <Plato key={p.id} plato={p} carta={carta} />
          ))}
        </ul>
      ))}
    </div>
  )
}

function Encabezado({ eyebrow, titulo, subtitulo, cursiva }: { eyebrow: string | null; titulo: string | null; subtitulo: string | null; cursiva: boolean }) {
  if (!eyebrow && !titulo && !subtitulo) return null
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-[0.24em]" style={{ color: ACENTO }}>
          {eyebrow}
        </p>
      )}
      {titulo && (
        <h2 className={cn('leading-tight text-foreground [font-family:var(--font-heading)]', cursiva ? 'text-5xl italic md:text-7xl' : 'text-3xl md:text-5xl')}>{titulo}</h2>
      )}
      {cursiva && titulo && (
        <span className="flex items-center gap-3 text-muted-foreground" aria-hidden="true">
          <span className="h-px w-10 bg-current opacity-40" />
          <span className="text-[10px]">◇</span>
          <span className="h-px w-10 bg-current opacity-40" />
        </span>
      )}
      {subtitulo && <p className="max-w-md text-sm leading-6 text-muted-foreground md:text-base">{subtitulo}</p>}
    </div>
  )
}

function SelectorSede({ sedes, estilo }: { sedes: SedeCarta[]; estilo: DatosCarta['branchSelectorStyle'] }) {
  const recordar = (id: number) => {
    try {
      window.localStorage.setItem(CLAVE_SEDE_RECORDADA, String(id))
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
  }
  return (
    <nav aria-label="Sede" className="flex justify-center">
      <ul className={cn('flex flex-wrap items-center gap-1', estilo === 'pill' ? 'rounded-full border border-border p-1' : 'gap-4')}>
        {sedes.map((s) => {
          const clase = cn(
            'inline-flex min-h-10 items-center rounded-full px-5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors',
            s.actual ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted',
          )
          return (
            <li key={s.id}>
              {s.actual || !s.href ? (
                <span className={clase} aria-current={s.actual ? 'page' : undefined}>
                  {s.nombre}
                </span>
              ) : (
                <Link href={s.href} className={clase} onClick={() => recordar(s.id)}>
                  {s.nombre}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function CartaPuntos({ carta, eyebrow, titulo, subtitulo, categorias, destacados, sedes }: CartaPuntosProps) {
  const base = useId().replace(/:/g, '')
  const [activa, setActiva] = useState(categorias[0]?.id ?? 0)
  const actual = useMemo(() => categorias.find((c) => c.id === activa) ?? categorias[0] ?? null, [categorias, activa])

  // La sede de la página queda recordada para preseleccionarla en Reservas (E7).
  const sedeActual = sedes.find((s) => s.actual)?.id ?? null
  useEffect(() => {
    if (sedeActual === null) return
    try {
      window.localStorage.setItem(CLAVE_SEDE_RECORDADA, String(sedeActual))
    } catch {
      /* sin almacenamiento */
    }
  }, [sedeActual])

  if (carta.onlyFeatured) {
    if (destacados.length === 0) return null
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 md:px-6" data-carta-puntos="destacados">
        <Encabezado eyebrow={eyebrow} titulo={titulo} subtitulo={subtitulo} cursiva={false} />
        <Platos platos={destacados} carta={{ ...carta, columns: 2 }} />
        {carta.viewAllText && (
          <div className="flex justify-center">
            <Link
              href={carta.viewAllUrl}
              {...BOTON_SECUNDARIO}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/40 px-6 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-muted"
            >
              {carta.viewAllText}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    )
  }

  if (!actual) return null
  const pestanaClase = (sel: boolean) =>
    cn(
      'whitespace-nowrap px-1 py-2 text-lg transition-colors',
      carta.tabsStyle === 'italic' && cn('italic [font-family:var(--font-heading)] border-b-2', sel ? 'border-current text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'),
      carta.tabsStyle === 'underline' && cn('text-sm font-medium uppercase tracking-[0.12em] border-b-2 md:text-sm', sel ? 'border-current text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'),
      carta.tabsStyle === 'pill' && cn('rounded-full px-4 text-sm md:text-base', sel ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'),
    )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 md:px-6" data-carta-puntos="completa">
      <Encabezado eyebrow={eyebrow} titulo={titulo} subtitulo={subtitulo} cursiva={carta.tabsStyle === 'italic'} />
      {sedes.length > 0 && <SelectorSede sedes={sedes} estilo={carta.branchSelectorStyle} />}

      {categorias.length > 1 && (
        <div
          className={cn('-mx-4 border-b border-border px-4 md:mx-0 md:border-0 md:px-0', carta.stickyTabs && 'sticky z-10')}
          style={{ backgroundColor: 'var(--background-color)', ...(carta.stickyTabs ? { top: 'var(--header-h, 0px)' } : {}) }}
        >
          <div role="tablist" aria-label="Categorías de la carta" className="flex gap-6 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:justify-center md:gap-x-9 md:gap-y-1">
            {categorias.map((c) => {
              const sel = c.id === actual.id
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  id={`${base}-tab-${c.id}`}
                  aria-selected={sel}
                  aria-controls={`${base}-panel`}
                  tabIndex={sel ? 0 : -1}
                  onClick={() => setActiva(c.id)}
                  onKeyDown={(e) => {
                    const i = categorias.findIndex((x) => x.id === c.id)
                    const siguiente = e.key === 'ArrowRight' ? categorias[i + 1] : e.key === 'ArrowLeft' ? categorias[i - 1] : null
                    if (siguiente) {
                      e.preventDefault()
                      setActiva(siguiente.id)
                      document.getElementById(`${base}-tab-${siguiente.id}`)?.focus()
                    }
                  }}
                  className={pestanaClase(sel)}
                >
                  {c.nombre}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div role={categorias.length > 1 ? 'tabpanel' : undefined} id={`${base}-panel`} aria-labelledby={categorias.length > 1 ? `${base}-tab-${actual.id}` : undefined} className="flex flex-col gap-4">
        {carta.showCounter && (
          <div className="flex items-center gap-4 text-muted-foreground" aria-live="polite">
            <span className="h-px flex-1 bg-current opacity-30" aria-hidden="true" />
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]">{textoContador(actual.nombre, actual.platos.length, carta.counterLabel)}</p>
            <span className="h-px flex-1 bg-current opacity-30" aria-hidden="true" />
          </div>
        )}
        <Platos platos={actual.platos} carta={carta} />
      </div>
    </div>
  )
}
