'use client';

/**
 * Lo nuevo de la barra superior (Figma «16 Sitio web», láminas de cada plantilla):
 * - sede y «Abierto ahora · Cierra a las 23:00» (topbar_show_branch_status), con el horario de la
 *   sede en la zona horaria de la sede/organización, calculado en el navegador tras montar
 *   (`useEstadosEnVivo`, el mismo de «Horario y sedes» y del selector de sede);
 * - «Envío gratis desde $ …» (topbar_show_free_shipping, `free_shipping_threshold`);
 * - cupos libres del parqueadero (topbar_show_availability);
 * - idioma (header_show_language + site_locales; no sale mientras IDIOMAS_DISPONIBLES solo
 *   tenga español, ver lib/website/encabezadoPie.ts).
 * Con todo en su default no devuelve nada y HeaderTopbar se pinta como siempre.
 */
import { useMemo } from 'react';
import { Car, Globe, MapPin, Truck } from 'lucide-react';
import { useEncabezadoPie } from '../EncabezadoPieContext';
import { useEstadosEnVivo } from '@/components/sections/restaurant/EstadoApertura';
import { NOMBRE_IDIOMA, textoCupos, textoEnvioGratis } from '@/lib/website/encabezadoPie';

const PUNTO: Record<string, string> = {
  open: '#22C55E',
  closing_soon: '#F59E0B',
  closed: '#EF4444',
};

export function useTopbarExtras(estilo?: React.CSSProperties): { izquierda: React.ReactNode[]; idioma: React.ReactNode | null } {
  const { opciones, extras } = useEncabezadoPie();
  const sede = opciones.topbar.estadoSede ? extras.sedeEstado : null;
  const sedes = useMemo(
    () => (sede ? [{ id: sede.id, horario: sede.horario, zonaHoraria: sede.zonaHoraria }] : []),
    [sede],
  );
  const estados = useEstadosEnVivo(sedes);
  const apertura = sede ? estados?.get(sede.id)?.apertura ?? null : null;

  const izquierda: React.ReactNode[] = [];
  if (sede) {
    izquierda.push(
      <span key="sede" className="flex items-center gap-1 whitespace-nowrap" style={estilo}>
        <MapPin className="h-3 w-3" aria-hidden="true" />
        {sede.nombre}
        {sede.direccion ? <span className="hidden lg:inline"> · {sede.direccion}</span> : null}
      </span>,
    );
    if (apertura) {
      izquierda.push(
        <span key="estado" className="flex items-center gap-1.5 whitespace-nowrap" style={estilo} data-estado-sede={apertura.estado}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PUNTO[apertura.estado] }} aria-hidden="true" />
          {apertura.texto}
        </span>,
      );
    }
  }
  const envio = opciones.topbar.envioGratis ? textoEnvioGratis(extras.envioGratisDesde) : null;
  if (envio) {
    izquierda.push(
      <span key="envio" className="flex items-center gap-1 whitespace-nowrap" style={estilo}>
        <Truck className="h-3 w-3" aria-hidden="true" />
        {envio}
      </span>,
    );
  }
  const cupos = opciones.topbar.cupos ? textoCupos(extras.cuposLibres) : null;
  if (cupos) {
    izquierda.push(
      <span key="cupos" className="flex items-center gap-1.5 whitespace-nowrap" style={estilo}>
        <Car className="h-3 w-3" aria-hidden="true" />
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: extras.cuposLibres ? PUNTO.open : PUNTO.closed }} aria-hidden="true" />
        {cupos}
      </span>,
    );
  }

  const idioma = opciones.idiomas.length >= 2 ? (
    <span key="idioma" className="flex items-center gap-1 whitespace-nowrap" style={estilo} title="Idioma">
      <Globe className="h-3 w-3" aria-hidden="true" />
      {opciones.idiomas.map((l) => NOMBRE_IDIOMA[l]?.corto ?? l).join(' / ')}
    </span>
  ) : null;

  return { izquierda, idioma };
}
