'use client';

/**
 * Categorías del menú del celular con «Lista con imagen redonda» o «Tarjetas con imagen» (Figma
 * «16 Sitio web» 3290:101848, aprobado el 2026-11-25). Una sola pieza para el cajón, la pantalla
 * completa, la hoja de categorías (pestañas y menú inferior), el panel configurable y el
 * encabezado mínimo. Con «Lista con ícono» (por defecto) nadie la usa: cada menú pinta su fila de
 * siempre.
 *
 * - Círculo: la imagen de la categoría; si no tiene (o no carga), su ícono sobre su color; si no,
 *   la inicial. Sin color propio (o con el morado por defecto de la base), círculo neutro.
 * - Glifo blanco o casi negro según el color; el texto de la fila sigue el color del menú; un aro
 *   del color del texto evita que el círculo se pierda en el fondo.
 * - La padre se despliega con «Ver todo» y sus hijas, marcadas con un punto del color de la padre.
 * - Tarjetas: cuadrícula de 2 columnas; la que tiene hijas abre el segundo nivel ahí mismo.
 *
 * Qué pinta cada categoría sale de `avatarCategoria` (lib/website/v2/categoriasCabecera.ts).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from '@/components/site/Enlace';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { IconoGuardado } from '@/components/site/IconoGuardado';
import type { NavItem } from '../HeaderShared';
import { avatarCategoria, colorTextoSobre, type AvatarCategoria } from '@/lib/website/v2/categoriasCabecera';

/** Colores del menú (con respaldo al color heredado en el panel configurable, que no los define). */
const TEXTO = 'var(--mm-fg, currentColor)';
const TEXTO_SUAVE = 'var(--mm-fg-muted, currentColor)';
const NEUTRO = `color-mix(in srgb, ${TEXTO} 8%, transparent)`;
const ARO = `0 0 0 1px color-mix(in srgb, ${TEXTO} 16%, transparent)`;
const HOVER = 'hover:bg-[var(--mm-hover-bg,rgba(127,127,127,0.12))]';
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1';

type Fase = 'imagen' | 'icono' | 'inicial';

/** Imagen → ícono → inicial; si la imagen falla al cargar, pasa al siguiente. */
function useFaseAvatar(avatar: AvatarCategoria): [Fase, () => void] {
  const [rota, setRota] = useState<string | null>(null);
  const fase: Fase = avatar.imagen && avatar.imagen !== rota ? 'imagen' : avatar.icono ? 'icono' : 'inicial';
  return [fase, () => setRota(avatar.imagen)];
}

const avatarDe = (item: NavItem): AvatarCategoria => item.avatar ?? avatarCategoria({ nombre: item.name, icono: item.icon });

function Glifo({ avatar, fase, nombre, claseIcono, claseInicial }: { avatar: AvatarCategoria; fase: Fase; nombre: string; claseIcono: string; claseInicial: string }) {
  if (fase === 'icono') return <IconoGuardado icono={avatar.icono} nombre={nombre} className={claseIcono} conRespaldo />;
  return (
    <span aria-hidden="true" className={`font-semibold leading-none ${claseInicial}`}>
      {avatar.inicial}
    </span>
  );
}

/** Fondo de la categoría (círculo, tarjeta o franja): decorativo, el nombre va en el texto. */
function FondoCategoria({
  avatar,
  nombre,
  clase,
  claseIcono,
  claseInicial,
  children,
}: {
  avatar: AvatarCategoria;
  nombre: string;
  clase: string;
  claseIcono: string;
  claseInicial: string;
  children?: (fase: Fase) => ReactNode;
}) {
  const [fase, marcarRota] = useFaseAvatar(avatar);
  return (
    <span
      aria-hidden="true"
      data-fondo-categoria={fase}
      className={`relative flex flex-shrink-0 items-center overflow-hidden ${clase}`}
      style={{ backgroundColor: avatar.fondo ?? NEUTRO, color: avatar.glifo ?? TEXTO, boxShadow: ARO }}
    >
      {fase === 'imagen' && avatar.imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar.imagen} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={marcarRota} />
      ) : (
        <Glifo avatar={avatar} fase={fase} nombre={nombre} claseIcono={claseIcono} claseInicial={claseInicial} />
      )}
      {children?.(fase)}
    </span>
  );
}

export function CirculoCategoria({ item }: { item: NavItem }) {
  return <FondoCategoria avatar={avatarDe(item)} nombre={item.name} clase="h-9 w-9 justify-center rounded-full" claseIcono="h-[18px] w-[18px]" claseInicial="text-sm" />;
}

function Punto({ color }: { color: string | null }) {
  return <span aria-hidden="true" className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color ?? TEXTO_SUAVE, boxShadow: ARO }} />;
}

/**
 * Fila de una categoría con su círculo. Con hijas, botón que despliega «Ver todo» y las hijas
 * (aria-expanded); sin hijas, enlace a su página.
 */
export function FilaCategoriaMovil({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  const hijos = item.children ?? [];
  const avatar = avatarDe(item);
  const fila = `flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1 text-left font-medium transition-colors ${HOVER} ${FOCO}`;
  const nombre = <span className="min-w-0 flex-1 truncate">{item.name}</span>;

  if (hijos.length === 0) {
    return (
      <Link href={item.href} className={fila} style={{ color: TEXTO }} onClick={onNavigate} data-fila-categoria="">
        <CirculoCategoria item={item} />
        {nombre}
      </Link>
    );
  }
  return (
    <div data-fila-categoria="" data-submenu-categoria="">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((v) => !v)}
        className={fila}
        style={{ color: TEXTO, ...(abierta ? { backgroundColor: 'var(--mm-hover-bg, rgba(127,127,127,0.12))' } : {}) }}
      >
        <CirculoCategoria item={item} />
        {nombre}
        <ChevronDown aria-hidden="true" className={`h-4 w-4 flex-shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} style={{ color: TEXTO_SUAVE }} />
      </button>
      <ul id={id} hidden={!abierta} className="pb-1 pl-[3.25rem]">
        <li>
          <Link href={item.href} onClick={onNavigate} className={`flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold ${HOVER} ${FOCO}`} style={{ color: TEXTO }}>
            Ver todo
          </Link>
        </li>
        {hijos.map((h, k) => (
          <li key={k}>
            <Link href={h.href} onClick={onNavigate} className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm ${HOVER} ${FOCO}`} style={{ color: TEXTO_SUAVE }}>
              <Punto color={avatar.fondo} />
              <span className="min-w-0 flex-1 truncate">{h.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lista de categorías con círculo (las que no traen círculo van como fila de siempre en quien la llame). */
export function ListaCategoriasMovil({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  return (
    <div className="space-y-0.5" data-lista-categorias="redonda">
      {items.map((it, i) => (
        <FilaCategoriaMovil key={i} item={it} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

const textoSubcategorias = (n: number) => (n === 1 ? '1 subcategoría' : `${n} subcategorías`);

function TarjetaCategoria({ item, indice, onAbrir, onNavigate }: { item: NavItem; indice: number; onAbrir: () => void; onNavigate: () => void }) {
  const n = item.children?.length ?? 0;
  const contenido = (
    <>
      <FondoCategoria avatar={avatarDe(item)} nombre={item.name} clase="aspect-[4/3] w-full justify-center rounded-xl" claseIcono="h-10 w-10" claseInicial="text-3xl" />
      <span className="mt-2 block truncate text-sm font-semibold" style={{ color: TEXTO }}>{item.name}</span>
      {n > 0 && <span className="block truncate text-xs" style={{ color: TEXTO_SUAVE }}>{textoSubcategorias(n)}</span>}
    </>
  );
  const clase = `block w-full rounded-xl p-0.5 text-left ${FOCO}`;
  return n > 0 ? (
    <button type="button" onClick={onAbrir} className={clase} data-tarjeta-categoria={indice}>
      {contenido}
    </button>
  ) : (
    <Link href={item.href} onClick={onNavigate} className={clase} data-tarjeta-categoria={indice}>
      {contenido}
    </Link>
  );
}

/** Segundo nivel de una tarjeta con hijas: franja de la categoría, «Ver todo …» y sus hijas. */
function SegundoNivel({ item, primaryColor, onNavigate, onVolver }: { item: NavItem; primaryColor: string; onNavigate: () => void; onVolver?: () => void }) {
  const avatar = avatarDe(item);
  return (
    <div data-segundo-nivel="">
      {onVolver && (
        // eslint-disable-next-line jsx-a11y/no-autofocus
        <button type="button" autoFocus onClick={onVolver} className={`mb-2 flex min-h-11 items-center gap-1 rounded-lg pr-2 text-base font-semibold ${FOCO}`} style={{ color: TEXTO }}>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only">Volver a las categorías: </span>
          {item.name}
        </button>
      )}
      <FondoCategoria avatar={avatar} nombre={item.name} clase="h-28 w-full justify-end rounded-xl" claseIcono="mr-6 h-14 w-14 opacity-80" claseInicial="mr-6 text-5xl opacity-80">
        {(fase) => (
          <span
            className="absolute inset-x-0 bottom-0 truncate px-4 pb-3 pt-8 text-xl font-bold"
            style={fase === 'imagen' ? { color: '#FFFFFF', backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' } : undefined}
          >
            {item.name}
          </span>
        )}
      </FondoCategoria>
      <Link
        href={item.href}
        onClick={onNavigate}
        className={`mt-3 flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold ${FOCO}`}
        style={{ backgroundColor: primaryColor, color: colorTextoSobre(primaryColor) }}
      >
        Ver todo {item.name}
      </Link>
      <ul className="mt-2">
        {(item.children ?? []).map((h, k) => (
          <li key={k} className="border-b border-[color:var(--mm-divider,rgba(127,127,127,0.2))]">
            <Link href={h.href} onClick={onNavigate} className={`flex min-h-11 items-center gap-3 px-1 text-sm font-medium ${HOVER} ${FOCO}`} style={{ color: TEXTO }}>
              <Punto color={avatar.fondo} />
              <span className="min-w-0 flex-1 truncate">{h.name}</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0" style={{ color: TEXTO_SUAVE }} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * «Tarjetas con imagen»: cuadrícula de 2 columnas. Tocar una tarjeta con hijas no navega: muestra el
 * segundo nivel ahí mismo. `abierta`/`onAbrir` la controlan desde fuera (la hoja de categorías pone
 * «‹ Nombre» en su cabecera y pasa `conVolver={false}`); sin ellos, lleva su propio «‹ Nombre».
 */
export function CuadriculaCategorias({
  items,
  primaryColor,
  onNavigate,
  abierta,
  onAbrir,
  conVolver = true,
}: {
  items: NavItem[];
  primaryColor: string;
  onNavigate: () => void;
  abierta?: number | null;
  onAbrir?: (indice: number | null) => void;
  conVolver?: boolean;
}) {
  const [propia, setPropia] = useState<number | null>(null);
  const indice = abierta !== undefined ? abierta : propia;
  const abrir = (i: number | null) => (onAbrir ? onAbrir(i) : setPropia(i));
  const caja = useRef<HTMLDivElement>(null);
  const anterior = useRef<number | null>(null);
  // Al volver a la cuadrícula, el foco regresa a la tarjeta que abrió el segundo nivel.
  useEffect(() => {
    if (indice === null && anterior.current !== null) {
      caja.current?.querySelector<HTMLElement>(`[data-tarjeta-categoria="${anterior.current}"]`)?.focus();
    }
    anterior.current = indice;
  }, [indice]);
  const padre = indice !== null ? items[indice] : undefined;
  return (
    <div ref={caja} data-lista-categorias="tarjetas">
      {padre && (padre.children?.length ?? 0) > 0 ? (
        <SegundoNivel item={padre} primaryColor={primaryColor} onNavigate={onNavigate} onVolver={conVolver ? () => abrir(null) : undefined} />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {items.map((it, i) => (
            <li key={i} className="min-w-0">
              <TarjetaCategoria item={it} indice={i} onAbrir={() => abrir(i)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
