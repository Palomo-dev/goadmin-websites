'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type React from 'react';
import { usePanelBajoEnlace } from './menuDeslizable';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { NavItem } from './HeaderShared';

interface NavDropdownProps {
  item: NavItem;
  primaryColor: string;
  /** Lo que se ve en la barra (menús adicionales). Sin él, como siempre. */
  disparador?: React.ReactNode;
}

/**
 * Dropdown simple para sub-páginas jerárquicas.
 * Se abre al hover (desktop) sobre el wrapper div que contiene el item de nav.
 * Soporta children anidados hasta nivel 2 (indentados).
 */
export function NavDropdown({ item, primaryColor, disparador }: NavDropdownProps) {
  if (disparador) return <DesplegableFlotante item={item} primaryColor={primaryColor} disparador={disparador} />;
  return <DesplegableClasico item={item} primaryColor={primaryColor} />;
}

/** Desplegable de siempre (páginas con subpáginas): sin cambios. */
function DesplegableClasico({ item, primaryColor }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ancla = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Menú que se desliza (no cabe): el panel va bajo su enlace sin quedar recortado. Si cabe, {}.
  const posPanel = usePanelBajoEnlace(isOpen, ancla, panel);

  if (!item.children || item.children.length === 0) return null;

  return (
    <div
      ref={ancla}
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {isOpen && (
        <div
          ref={panel}
          style={posPanel}
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

/**
 * Menú adicional de Encabezado: el panel va en un portal con posición fija bajo su botón, fuera de
 * la barra que se desliza (overflow + máscara) y sobre el encabezado. Abre con clic o al pasar el
 * mouse; cierra con Escape, clic afuera o al salir. Abrirlo no mueve la barra.
 */
function DesplegableFlotante({ item, primaryColor, disparador }: NavDropdownProps) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ancla = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Al pasar el mouse ya se abre: el clic que sigue no debe cerrarlo.
  const abiertoEn = useRef(0);
  const cancelarCierre = () => { if (cierre.current) { clearTimeout(cierre.current); cierre.current = null; } };
  const cerrarLuego = () => { cancelarCierre(); cierre.current = setTimeout(() => setAbierto(false), 150); };
  const colocar = useCallback(() => {
    const a = ancla.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const ancho = panel.current?.offsetWidth ?? 224;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)), top: r.bottom });
  }, []);
  const efecto = typeof window === 'undefined' ? useEffect : useLayoutEffect;
  efecto(() => { if (abierto) colocar(); }, [abierto, colocar]);
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAbierto(false); (ancla.current?.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true }); } };
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ancla.current?.contains(t) || panel.current?.contains(t)) return;
      setAbierto(false);
    };
    document.addEventListener('keydown', tecla);
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('resize', colocar);
    window.addEventListener('scroll', colocar, true);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('pointerdown', fuera);
      window.removeEventListener('resize', colocar);
      window.removeEventListener('scroll', colocar, true);
    };
  }, [abierto, colocar]);
  useEffect(() => () => cancelarCierre(), []);
  if (!item.children || item.children.length === 0) return null;
  return (
    <div
      ref={ancla}
      className="relative"
      data-desplegable-flotante=""
      onMouseEnter={() => { cancelarCierre(); if (!abierto) abiertoEn.current = Date.now(); setAbierto(true); }}
      onMouseLeave={cerrarLuego}
      onClickCapture={(e) => { if ((e.target as HTMLElement).closest('button')) { e.preventDefault(); const reciente = Date.now() - abiertoEn.current < 600; if (!abierto) abiertoEn.current = Date.now(); setAbierto(reciente ? true : !abierto); } }}
      aria-expanded={abierto}
    >
      {disparador}
      {abierto && typeof document !== 'undefined' && createPortal(
        <div
          ref={panel}
          role="menu"
          aria-label={`Sub-menú de ${item.name}`}
          data-panel-menu-adicional=""
          onMouseEnter={cancelarCierre}
          onMouseLeave={cerrarLuego}
          style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, zIndex: 1000 }}
          className="w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2"
        >
          <Link href={item.href} onClick={() => setAbierto(false)} className="flex items-center justify-between gap-1 px-3 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: primaryColor }}>
            Ver todo
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />
          <ul className="flex flex-col">
            {item.children.map((child, i) => (
              <li key={i}>
                <Link href={child.href} onClick={() => setAbierto(false)} className="block px-3 py-1.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {child.name}
                </Link>
                {child.children && child.children.length > 0 && (
                  <ul className="flex flex-col ml-3 border-l border-gray-100 dark:border-gray-800">
                    {child.children.map((grandchild, j) => (
                      <li key={j}>
                        <Link href={grandchild.href} onClick={() => setAbierto(false)} className="block pl-3 pr-3 py-1.5 rounded-md text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
                          {grandchild.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default NavDropdown;
