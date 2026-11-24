'use client'

/**
 * Pestañas deslizables de Mi cuenta en el celular (Figma «16 Sitio web» 3044:78726, pantallas 7–9;
 * decisión del dueño 2026-11-24: el «←» a Mi cuenta Y ADEMÁS pestañas para saltar entre secciones
 * sin volver a Inicio). Los ítems salen del mismo `menuCuenta(tipo de negocio)` que pone el layout
 * (reservas, citas, membresía, pases… según el negocio); la activa se ve subrayada y, al entrar,
 * la tira se desliza para mostrarla con la anterior asomando. Solo celular (`md:hidden`): en
 * escritorio está el menú lateral.
 */
import Link from '@/components/site/Enlace'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { itemActivo, type ItemMenuCuenta } from '@/lib/cuenta/reglasCuenta'

const ContextoMenuCuenta = createContext<readonly ItemMenuCuenta[] | null>(null)

/** Lo monta el layout de Mi cuenta con el menú del negocio. */
export function ProveedorMenuCuenta({ items, children }: { items: readonly ItemMenuCuenta[]; children: ReactNode }) {
  return <ContextoMenuCuenta.Provider value={items}>{children}</ContextoMenuCuenta.Provider>
}

export function PestanasCuenta({ className = '' }: { className?: string }) {
  const items = useContext(ContextoMenuCuenta)
  const ruta = usePathname()
  const tira = useRef<HTMLElement | null>(null)
  const lista = (items ?? []).filter((i) => i.clave !== 'inicio' && i.clave !== 'factura')
  const activo = itemActivo(lista, ruta)

  useEffect(() => {
    const nav = tira.current
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !el) return
    const anterior = el.previousElementSibling as HTMLElement | null
    nav.scrollLeft = Math.max(0, (anterior ? anterior.offsetLeft : el.offsetLeft) - 16)
  }, [activo])

  if (lista.length < 2) return null
  return (
    <nav
      ref={tira}
      aria-label="Secciones de Mi cuenta"
      className={`-mx-4 flex gap-5 overflow-x-auto border-b border-slate-200 px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden ${className}`}
      data-pestanas-cuenta=""
    >
      {lista.map((it) => {
        const es = it.clave === activo
        return (
          <Link
            key={it.clave}
            href={it.href}
            aria-current={es ? 'page' : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 pt-1 text-sm ${es ? 'font-semibold' : 'border-transparent font-medium text-slate-600'}`}
            style={es ? { borderColor: 'var(--primary-color)', color: 'var(--primary-color)' } : undefined}
          >
            {it.texto}
          </Link>
        )
      })}
    </nav>
  )
}
