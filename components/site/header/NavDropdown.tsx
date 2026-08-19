'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { NavItem } from './HeaderShared';

interface NavDropdownProps {
  item: NavItem;
  primaryColor: string;
}

/**
 * Dropdown simple para sub-páginas jerárquicas.
 * Se abre al hover (desktop) sobre el wrapper div que contiene el item de nav.
 * Soporta children anidados hasta nivel 2 (indentados).
 */
export function NavDropdown({ item, primaryColor }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!item.children || item.children.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 animate-in fade-in slide-in-from-top-1 duration-150"
          role="menu"
          aria-label={`Sub-menú de ${item.name}`}
        >
          {/* Link al padre */}
          <Link
            href={item.href}
            className="flex items-center justify-between gap-1 px-3 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ color: primaryColor }}
          >
            Ver todo
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />

          {/* Lista de children */}
          <ul className="flex flex-col">
            {item.children.map((child, i) => (
              <li key={i}>
                <Link
                  href={child.href}
                  className="block px-3 py-1.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {child.name}
                </Link>

                {/* Nivel 2 indentado */}
                {child.children && child.children.length > 0 && (
                  <ul className="flex flex-col ml-3 border-l border-gray-100 dark:border-gray-800">
                    {child.children.map((grandchild, j) => (
                      <li key={j}>
                        <Link
                          href={grandchild.href}
                          className="block pl-3 pr-3 py-1.5 rounded-md text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                          {grandchild.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NavDropdown;
