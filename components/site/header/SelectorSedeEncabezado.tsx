'use client';

/**
 * Selector de sede DENTRO del encabezado (header_show_branch_selector = true; láminas de Figma
 * «16 Sitio web»: Mediterráneo y Carta QR). En escritorio va como chip junto a los botones; en el
 * celular, en una fila bajo la barra del encabezado.
 *
 * Solo pinta si OrganizationLayoutCliente lo puso en el contexto (opción activa y 2 o más sedes
 * publicadas); entonces la franja bajo el encabezado no se pinta. Con la opción apagada (default)
 * no devuelve nada y la franja de siempre sigue en su sitio.
 */
import { useEncabezadoPie } from '../EncabezadoPieContext';
import { SelectorSede } from './SelectorSede';

export function SelectorSedeEncabezado({ primaryColor }: { primaryColor: string }) {
  const { selector } = useEncabezadoPie();
  if (!selector) return null;
  return (
    <div className="hidden md:block" data-selector-sede-encabezado="">
      <SelectorSede
        sedes={selector.sedes}
        actualId={selector.actualId}
        subdomain={selector.subdomain}
        primaryColor={primaryColor}
        prefijoActual={selector.prefijoActual}
        hrefTodas={selector.hrefTodas}
      />
    </div>
  );
}

/** Fila del celular bajo la barra del encabezado. */
export function FilaSedeMovil({ primaryColor }: { primaryColor: string }) {
  const { selector } = useEncabezadoPie();
  if (!selector) return null;
  return (
    <div className="border-b border-gray-100 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900" data-selector-sede-encabezado="">
      <SelectorSede
        sedes={selector.sedes}
        actualId={selector.actualId}
        subdomain={selector.subdomain}
        primaryColor={primaryColor}
        prefijoActual={selector.prefijoActual}
        hrefTodas={selector.hrefTodas}
      />
    </div>
  );
}
