'use client';

/**
 * Botón «Todas las categorías» de la barra de menú (Figma «16 Sitio web» 2689:57377, aprobado el
 * 2026-11-19). Color primario de la tienda, a la izquierda del menú. Abre al pasar el mouse o con
 * clic: lista vertical (ícono y color de cada categoría, en el orden de la tienda, con scroll) y,
 * si la fila tiene subcategorías, el panel de la derecha. «Ver todas las categorías» al final.
 *
 * El panel tiene colores propios (blanco, texto #111827): no hereda el texto del encabezado.
 * Qué listar y el texto salen de `botonCategoriasBarra` (lib/website/botonCategorias.ts).
 */
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/site/Enlace'
import { ArrowRight, ChevronDown, ChevronRight, Menu } from 'lucide-react';
import { IconoGuardado } from '@/components/site/IconoGuardado';
import { colorTextoSobre, type EntradaCategoria } from '@/lib/website/botonCategorias';

const MAX_HIJOS = 12;

export function BotonTodasCategorias({
  texto,
  entradas,
  primaryColor,
  hrefTodas,
}: {
  texto: string;
  entradas: EntradaCategoria[];
  primaryColor: string;
  /** Página de todas las categorías (con el prefijo de la sede, si aplica). */
  hrefTodas: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textoBoton = colorTextoSobre(primaryColor);

  // Cuándo lo abrió el mouse: el clic que sigue al pasar por encima no debe cerrarlo otra vez.
  const abiertoPorMouse = useRef(0);
  const abrir = () => {
    if (cierre.current) clearTimeout(cierre.current);
    if (!abierto) abiertoPorMouse.current = Date.now();
    setAbierto(true);
  };
  const alternar = () => {
    if (!abierto) return setAbierto(true);
    if (Date.now() - abiertoPorMouse.current < 600) return;
    setAbierto(false);
  };
  // Un respiro al salir: pasar del botón al panel (o rozar el borde) no lo cierra.
  const cerrarLuego = () => {
    if (cierre.current) clearTimeout(cierre.current);
    cierre.current = setTimeout(() => setAbierto(false), 150);
  };

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  useEffect(() => () => {
    if (cierre.current) clearTimeout(cierre.current);
  }, []);

  // Al abrir, la primera con subcategorías queda marcada (como en los marketplaces).
  useEffect(() => {
    if (abierto) setActiva((a) => a ?? entradas.find((e) => e.hijos.length > 0)?.clave ?? null);
    else setActiva(null);
  }, [abierto, entradas]);

  const elegida = entradas.find((e) => e.clave === activa) ?? null;
  const conHijos = elegida && elegida.hijos.length > 0 ? elegida : null;

  return (
    <div ref={caja} className="relative flex-shrink-0" onMouseEnter={abrir} onMouseLeave={cerrarLuego} data-boton-categorias="">
      <button
        type="button"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ backgroundColor: primaryColor, color: textoBoton }}
      >
        <Menu aria-hidden="true" className="h-[18px] w-[18px]" />
        <span className="whitespace-nowrap">{texto}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="absolute left-0 top-full z-[60] pt-2">
          <div
            role="menu"
            aria-label={texto}
            className="flex overflow-hidden rounded-xl border border-gray-200 bg-white text-left text-[#111827] shadow-2xl"
          >
            <div className="flex w-[300px] flex-col">
              <ul className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain py-1.5 [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent]">
                {entradas.map((e) => {
                  const marcada = e.clave === activa;
                  const color = e.color || primaryColor;
                  return (
                    <li key={e.clave}>
                      <Link
                        href={e.href}
                        role="menuitem"
                        onMouseEnter={() => setActiva(e.clave)}
                        onFocus={() => setActiva(e.clave)}
                        onClick={() => setAbierto(false)}
                        className="flex h-11 items-center gap-3 px-4 text-sm transition-colors focus-visible:outline-none"
                        style={marcada ? { backgroundColor: `color-mix(in srgb, ${primaryColor} 9%, white)` } : undefined}
                      >
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center" style={{ color }}>
                          {e.imagen ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.imagen} alt="" className="h-6 w-6 rounded object-cover" loading="lazy" />
                          ) : (
                            <IconoGuardado icono={e.icono} nombre={e.nombre} className="h-[18px] w-[18px]" conRespaldo />
                          )}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate ${marcada ? 'font-semibold' : 'font-medium'}`}
                          style={{ color: marcada ? primaryColor : '#111827' }}
                        >
                          {e.nombre}
                        </span>
                        {e.hijos.length > 0 && (
                          <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0" style={{ color: marcada ? primaryColor : '#9CA3AF' }} />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href={hrefTodas}
                onClick={() => setAbierto(false)}
                className="flex items-center gap-1.5 border-t border-gray-200 px-4 py-3 text-sm font-semibold hover:underline"
                style={{ color: primaryColor }}
              >
                Ver todas las categorías
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>

            {conHijos && (
              <div className="w-[min(32rem,calc(100vw-22rem))] border-l border-gray-200 bg-[#FAFBFD] px-6 py-5" data-subcategorias="">
                <Link href={conHijos.href} onClick={() => setAbierto(false)} className="text-base font-bold text-[#111827] hover:underline">
                  {conHijos.nombre}
                </Link>
                <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2.5">
                  {conHijos.hijos.slice(0, MAX_HIJOS).map((h) => (
                    <li key={h.clave} className="min-w-0">
                      <Link
                        href={h.href}
                        role="menuitem"
                        onClick={() => setAbierto(false)}
                        className="block truncate text-sm text-[#4B5563] hover:text-[#111827] hover:underline"
                      >
                        {h.nombre}
                      </Link>
                    </li>
                  ))}
                  <li className="min-w-0">
                    <Link
                      href={conHijos.href}
                      onClick={() => setAbierto(false)}
                      className="block truncate text-sm font-semibold hover:underline"
                      style={{ color: primaryColor }}
                    >
                      Ver todo en {conHijos.nombre}
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
