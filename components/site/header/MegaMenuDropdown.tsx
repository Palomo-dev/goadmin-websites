'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from '@/components/site/Enlace'
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import type { MenuCategory, NavItem } from './HeaderShared';
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext';
import { IconoGuardado } from '@/components/site/IconoGuardado';

/** Columnas del panel de categorías: las del editor (2–4), nunca más que categorías haya. */
export function columnasPanelCategorias(columnas: number, cantidad: number): number {
  const elegidas = Math.min(Math.max(columnas || 4, 2), 4);
  return Math.max(1, Math.min(elegidas, cantidad));
}

/**
 * `left` del panel (relativo a la barra) para quedar centrado bajo el botón «Categorías» sin
 * salirse de la barra. Antes de medir, el panel no se ve (un solo cuadro, sin parpadeo).
 */
function usePosicionBajoAncla() {
  const panel = useRef<HTMLDivElement | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = panel.current;
    const barra = el?.offsetParent as HTMLElement | null;
    const ancla = el?.parentElement;
    if (!el || !barra || !ancla) return;
    const medir = () => {
      const b = barra.getBoundingClientRect();
      const a = ancla.getBoundingClientRect();
      const ancho = el.offsetWidth;
      const centro = a.left + a.width / 2 - b.left;
      setLeft(Math.max(0, Math.min(centro - ancho / 2, b.width - ancho)));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  return { panel, estilo: left === null ? { left: 0, visibility: 'hidden' as const } : { left } };
}

interface MegaMenuDropdownProps {
  categories?: MenuCategory[];
  items?: NavItem[];
  columns: number;
  primaryColor: string;
}

/**
 * Panel flotante multi-columna que se abre al hover sobre el item "Categorías"
 * en el header mega. Cada columna representa una categoría raíz con sus
 * sub-categorías listadas verticalmente debajo.
 */
export function MegaMenuDropdown({ categories, items, columns, primaryColor }: MegaMenuDropdownProps) {
  // Sitio de una sede por prefijo de ruta: las categorías de la sede.
  const { ruta } = useRutaSitio();
  const colCount = Math.min(Math.max(columns || 4, 2), 6);
  // Hasta `colCount` columnas de al menos 10rem; si no caben, el grid baja de columnas
  // en vez de apretar o salirse del panel (paquete 5-nov C3).
  const columnasGrid = `repeat(auto-fill, minmax(max(10rem, calc((100% - ${colCount - 1} * 1.5rem) / ${colCount})), 1fr))`;

  // Si hay items nombrados (sistema nuevo), renderizarlos
  if (items && items.length > 0) {
    return (
      <div
        className="absolute left-0 right-0 mx-auto w-[min(56rem,100%)] overflow-x-hidden top-full z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-2xl p-6 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
        role="menu"
        aria-label="Menú"
      >
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: columnasGrid }}
        >
          {items.map((item, i) => {
            const visibleChildren = (item.children || []).slice(0, 6);
            const hasMore = (item.children || []).length > 6;

            return (
              <div key={i} className="flex flex-col">
                {/* Header de columna */}
                <Link
                  href={item.href}
                  className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800 group"
                >
                  {item.icon && (
                    <span
                      className="flex items-center justify-center w-8 h-8 rounded-md text-base flex-shrink-0"
                      style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                    >
                      <IconoGuardado icono={item.icon} nombre={item.name} className="h-[18px] w-[18px]" />
                    </span>
                  )}
                  <span
                    className="text-sm font-semibold transition-colors"
                    style={{ color: primaryColor }}
                  >
                    {item.name}
                  </span>
                  {item.badge && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>

                {/* Sub-items */}
                <ul className="flex flex-col gap-1.5 flex-1">
                  {visibleChildren.map((child, j) => (
                    <li key={j}>
                      <Link
                        href={child.href}
                        className="block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors py-0.5"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* Ver todo */}
                {hasMore && (
                  <Link
                    href={item.href}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Ver todo
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Categorías (backward compat): grilla limpia de ícono + nombre.
  if (!categories || categories.length === 0) return null;
  return <PanelCategorias categories={categories} columns={columns} primaryColor={primaryColor} ruta={ruta} />;
}

/**
 * Panel de «Categorías»: celdas con el ícono (22 px) en una cajita suave del color de la
 * categoría o del primario de la tienda y el nombre al lado (una o dos líneas), sin líneas entre
 * filas; «Ver todas las categorías» al final. Ancho según el contenido, centrado bajo el botón.
 */
function PanelCategorias({
  categories,
  columns,
  primaryColor,
  ruta,
}: {
  categories: MenuCategory[];
  columns: number;
  primaryColor: string;
  ruta: (path: string) => string;
}) {
  const { panel, estilo } = usePosicionBajoAncla();
  const cols = columnasPanelCategorias(columns, categories.length);

  return (
    <div
      ref={panel}
      data-panel-categorias=""
      className="absolute top-full z-50 w-max max-w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-xl shadow-2xl p-4 max-h-[70vh] overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      style={estilo}
      role="menu"
      aria-label="Categorías"
    >
      <ul className="grid gap-x-2 gap-y-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 14rem))` }}>
        {categories.map((category) => {
          const visibleChildren = category.children.slice(0, 6);
          const hasMore = category.children.length > 6;
          const accentColor = category.color || primaryColor;
          const href = ruta(`/categorias/${category.slug}`);

          return (
            <li key={category.id} className="min-w-0">
              <Link
                href={href}
                role="menuitem"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--fondo-celda)] focus-visible:bg-[var(--fondo-celda)] focus-visible:outline-none"
                style={{ ['--fondo-celda' as string]: `${accentColor}12` }}
              >
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
                  style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
                >
                  {category.image_url ? (
                    <Image src={category.image_url} alt="" width={40} height={40} className="h-10 w-10 object-cover" />
                  ) : (
                    <IconoGuardado icono={category.icon} nombre={category.name} className="h-[22px] w-[22px]" conRespaldo />
                  )}
                </span>
                <span className="min-w-0 text-sm font-semibold leading-snug line-clamp-2" style={{ color: accentColor }}>
                  {category.name}
                </span>
              </Link>

              {visibleChildren.length > 0 && (
                <ul className="mb-1 flex flex-col gap-0.5 pl-[4rem] pr-3">
                  {visibleChildren.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={ruta(`/categorias/${child.slug}`)}
                        className="block truncate py-0.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                  {hasMore && (
                    <li>
                      <Link
                        href={href}
                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Ver todo
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex justify-center">
        <Link
          href={ruta('/categorias')}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color: primaryColor }}
        >
          Ver todas las categorías
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default MegaMenuDropdown;
