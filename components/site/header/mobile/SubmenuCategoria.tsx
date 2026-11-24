'use client';

/**
 * Categoría padre dentro del menú del celular (y del encabezado mínimo): se despliega ahí mismo
 * con «Ver todo» y sus subcategorías (categories.parent_id). Usa la clase de enlace del menú que la
 * contiene, para verse igual que sus vecinas. Una categoría sin hijas sigue siendo un enlace normal.
 */
import Link from '@/components/site/Enlace'
import { ChevronDown } from 'lucide-react';
import type { NavItem } from '../HeaderShared';
import { IconoGuardado } from '@/components/site/IconoGuardado';

export function SubmenuCategoria({
  item,
  claseEnlace,
  onNavigate,
}: {
  item: NavItem;
  claseEnlace: string;
  onNavigate: () => void;
}) {
  return (
    <details className="group/sub" data-submenu-categoria="">
      <summary className={`${claseEnlace} flex cursor-pointer list-none items-center justify-between gap-2`}>
        <span className="flex min-w-0 items-center gap-2">
          {item.icon && <IconoGuardado icono={item.icon} nombre={item.name} className="h-4 w-4 flex-shrink-0" />}
          <span className="truncate">{item.name}</span>
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 flex-shrink-0 transition-transform group-open/sub:rotate-180" />
      </summary>
      <div className="pl-4">
        <Link href={item.href} className={claseEnlace} onClick={onNavigate}>
          Ver todo
        </Link>
        {(item.children ?? []).map((h, k) => (
          <Link key={k} href={h.href} className={claseEnlace} onClick={onNavigate}>
            {h.name}
          </Link>
        ))}
      </div>
    </details>
  );
}
