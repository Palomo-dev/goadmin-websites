'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import type { MenuCategory, NavItem } from './HeaderShared';
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext';

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

  // Si hay items nombrados (sistema nuevo), renderizarlos
  if (items && items.length > 0) {
    return (
      <div
        className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-2xl p-6 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
        role="menu"
        aria-label="Menú"
      >
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
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
                      {item.icon}
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

  // Fallback: renderizar categorías (backward compat)
  if (!categories || categories.length === 0) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-2xl p-6 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
      role="menu"
      aria-label="Categorías"
    >
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
      >
        {categories.map((category) => {
          const visibleChildren = category.children.slice(0, 6);
          const hasMore = category.children.length > 6;
          const accentColor = category.color || primaryColor;

          return (
            <div key={category.id} className="flex flex-col">
              {/* Header de columna */}
              <Link
                href={ruta(`/categorias/${category.slug}`)}
                className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800 group"
              >
                {category.image_url ? (
                  <Image
                    src={category.image_url}
                    alt={category.name}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                  />
                ) : category.icon ? (
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-md text-base flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    {category.icon}
                  </span>
                ) : null}
                <span
                  className="text-sm font-semibold transition-colors"
                  style={{ color: accentColor }}
                >
                  {category.name}
                </span>
              </Link>

              {/* Sub-categorías */}
              <ul className="flex flex-col gap-1.5 flex-1">
                {visibleChildren.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={ruta(`/categorias/${child.slug}`)}
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
                  href={ruta(`/categorias/${category.slug}`)}
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

      {/* Footer del panel */}
      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-center">
        <Link
          href={ruta('/categorias')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
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
