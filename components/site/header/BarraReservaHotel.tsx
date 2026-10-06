'use client';

/**
 * Barra de reserva del hotel bajo el encabezado (header_booking_bar; Figma «16 Sitio web», Hotel
 * Lujo y Resort): Llegada · Salida · Huéspedes · «Ver disponibilidad».
 *
 * No inventa disponibilidad: envía las fechas a /reservas (`checkin`, `checkout`, `huespedes`),
 * donde ReservationWizard las toma y consulta la disponibilidad y el precio de siempre
 * (/api/reservations). Las fechas por defecto (mañana → pasado mañana) salen de la zona horaria
 * de la sede/organización, nunca de la del navegador. En el celular, una fila compacta.
 *
 * Con la opción apagada (default) no pinta nada.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, User } from 'lucide-react';
import { useEncabezadoPie } from '../EncabezadoPieContext';
import { fechaCorta, hoyEnZona, sumarDias } from '@/lib/restaurant/horario';
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento';

export function BarraReservaHotel({ primaryColor }: { primaryColor: string }) {
  const { opciones, extras } = useEncabezadoPie();
  const router = useRouter();
  const [entrada, setEntrada] = useState('');
  const [salida, setSalida] = useState('');
  const [huespedes, setHuespedes] = useState(2);
  const [hoy, setHoy] = useState('');

  // Tras montar: «hoy» en la zona de la sede (el HTML cacheado no fija una fecha vieja).
  useEffect(() => {
    const h = hoyEnZona(extras.sedeEstado?.zonaHoraria);
    setHoy(h);
    setEntrada(sumarDias(h, 1));
    setSalida(sumarDias(h, 2));
  }, [extras.sedeEstado?.zonaHoraria]);

  if (!opciones.barraReserva) return null;

  const enviar = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = new URLSearchParams();
    if (entrada) q.set('checkin', entrada);
    if (salida && salida > entrada) q.set('checkout', salida);
    q.set('huespedes', String(huespedes));
    router.push(`${extras.rutaReservas}?${q.toString()}`);
  };
  const textoBoton = textoSobreAcentoSiHex(primaryColor) ?? '#ffffff';
  // Colores del tema (--background-color / --text-color del layout; sin tema, blanco y gris oscuro).
  const campo = 'relative flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3.5 py-2';
  const estiloCampo: React.CSSProperties = {
    backgroundColor: 'var(--background-color, #ffffff)',
    borderColor: 'color-mix(in srgb, var(--text-color, #111827) 13%, var(--background-color, #ffffff))',
  };
  const etiqueta = 'block text-[11px] font-medium leading-tight opacity-60';
  const valor = 'block w-full bg-transparent text-sm font-medium leading-tight outline-none';

  return (
    <div
      data-barra-reserva=""
      style={{
        backgroundColor: 'color-mix(in srgb, var(--text-color, #111827) 6%, var(--background-color, #ffffff))',
        color: 'var(--text-color, #111827)',
      }}
    >
      {/* Escritorio */}
      <form onSubmit={enviar} className="mx-auto hidden max-w-7xl items-stretch gap-3 px-4 py-3 md:flex" aria-label="Buscar disponibilidad">
        <label className={campo} style={estiloCampo}>
          <CalendarDays className="h-4 w-4 flex-shrink-0 opacity-60" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className={etiqueta}>Llegada</span>
            {/* Fecha legible («Mié 7 oct») encima; el input nativo (transparente) abre el calendario. */}
            <span className={valor} aria-hidden="true">{entrada ? fechaCorta(entrada) : '—'}</span>
            <input type="date" aria-label="Llegada" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={entrada} min={hoy || undefined} onChange={(e) => setEntrada(e.target.value)} />
          </span>
        </label>
        <label className={campo} style={estiloCampo}>
          <CalendarDays className="h-4 w-4 flex-shrink-0 opacity-60" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className={etiqueta}>Salida</span>
            {/* Fecha legible («Mié 7 oct») encima; el input nativo (transparente) abre el calendario. */}
            <span className={valor} aria-hidden="true">{salida ? fechaCorta(salida) : '—'}</span>
            <input type="date" aria-label="Salida" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={salida} min={entrada || hoy || undefined} onChange={(e) => setSalida(e.target.value)} />
          </span>
        </label>
        <label className={campo} style={estiloCampo}>
          <User className="h-4 w-4 flex-shrink-0 opacity-60" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className={etiqueta}>Huéspedes</span>
            <select className={valor} value={huespedes} onChange={(e) => setHuespedes(Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === 1 ? '1 adulto' : `${n} adultos`}</option>
              ))}
            </select>
          </span>
        </label>
        <button
          type="submit"
          className="flex-shrink-0 rounded-md px-5 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: primaryColor, color: textoBoton }}
        >
          Ver disponibilidad
        </button>
      </form>
      {/* Celular: fila compacta; «Buscar» lleva a /reservas con las fechas propuestas. */}
      <div className="flex items-center gap-2 px-4 py-2 md:hidden">
        <CalendarDays className="h-4 w-4 flex-shrink-0 opacity-60" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {entrada && salida ? `${fechaCorta(entrada)} – ${fechaCorta(salida)} · ${huespedes} huéspedes` : 'Elige tus fechas'}
        </span>
        <button
          type="button"
          onClick={() => enviar()}
          className="flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-medium"
          style={{ backgroundColor: primaryColor, color: textoBoton }}
        >
          Buscar
        </button>
      </div>
    </div>
  );
}
