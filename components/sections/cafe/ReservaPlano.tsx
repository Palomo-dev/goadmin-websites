'use client'

/**
 * `reservation` · «Plano de mesas» (plantilla «Café de especialidad», Figma 2223:46106 láminas 03,
 * 04, 05 y 15). Contrato: lib/website/v2/contrato/seccionesCafe.ts (normalizarReservaPlano).
 *
 * El visitante elige sede, fecha, hora y personas, toca una mesa en el plano de POS › Mesas y deja
 * sus datos. Dos modos (`booking_mode`, E1 `resolverModoReserva`):
 *
 * - `erp`: disponibilidad real por mesa (`/api/restaurant-reservations/mesas`, solo lectura) y la
 *   reserva por el flujo de SIEMPRE (`useReservaMesa` → POST `/api/restaurant-reservations`, la
 *   RPC `create_restaurant_reservation`). Ese POST todavía no recibe la mesa (`p_table_id`): la
 *   mesa elegida viaja en las notas («Mesa elegida en el plano: …») y su zona como preferencia
 *   cuando la sede deja elegir zona. El equipo la ve en POS › Reservas de mesas.
 * - `whatsapp`: sin consulta de disponibilidad; arma el mensaje (`mensajeReservaWhatsapp`) y abre el
 *   chat del sitio. Con `also_register` y una sede que exige confirmación, deja además la solicitud
 *   por el mismo POST (queda «Por confirmar» con la nota «Solicitud por WhatsApp»).
 *
 * Nada de pagos ni pedidos aquí. Si la sede pide depósito, lo maneja el flujo de siempre.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Clock, MapPin, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReservaMesa } from '@/lib/restaurant/useReservaMesa'
import { TelefonoPais, telefonoValido } from '@/components/site/TelefonoPais'
import { useEncabezadoPie } from '@/components/site/EncabezadoPieContext'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/lib/website/botonSitio'
import { enlacesCalendario } from '@/components/sections/restaurant/ReservationView'
import { DIAS, ahoraEnZona, aMinutos, fechaCorta, fechaLarga, horaDeMinutos, hoyEnZona, sumarDias, turnosDe, type HorarioSemana } from '@/lib/restaurant/horario'
import { AJUSTES_RESERVA_POR_DEFECTO, limitesPersonas, type AjustesReserva } from '@/lib/restaurant/sedes-modelo'
import {
  estadoSinConsulta,
  leerDisponibilidadMesas,
  notaConMesa,
  planoConZonas,
  resumenMesa,
  type EstadoMesaWeb,
  type MesaDelPlano,
  type PlanoSede,
} from '@/lib/restaurant/planoMesas'
import {
  CLAVE_SEDE_RECORDADA,
  NOTA_SOLICITUD_WHATSAPP,
  TEXTO_BOTON_RESERVA,
  mensajeReservaWhatsapp,
  mesasMasParecidas,
  type ModoReserva,
  type ReservaPlano as DatosReserva,
} from '@/lib/website/v2/contrato/seccionesCafe'
import { PlanoMesas } from './PlanoMesas'

export interface SedeReservaPlano {
  id: number
  nombre: string
  direccion: string | null
  zonaHoraria: string
  ajustes: AjustesReserva | null
  horario: HorarioSemana | null
  modo: ModoReserva
  /** `null` = la sede no tiene plano dibujado: se reserva sin elegir mesa. */
  plano: PlanoSede | null
}

export interface ReservaPlanoProps {
  reserva: DatosReserva
  organizationId: number
  organizationName: string
  sedes: SedeReservaPlano[]
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  ctaText: string | null
  minGuests: number | null
  maxGuests: number | null
  maxDays: number | null
  requireEmail: boolean
  showNotes: boolean
  policyText: string | null
  successMessage: string | null
  pendingMessage: string | null
  anchorId: string
}

const ACENTO = 'var(--accent-color, var(--primary-color))'
const campo =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] disabled:opacity-60 dark:[color-scheme:dark]'
const tarjeta = 'min-w-0 rounded-3xl border border-border p-5 md:p-6'
const fondoTarjeta = { backgroundColor: 'color-mix(in srgb, var(--background-color, #fff) 60%, #fff)' }
const botonPrincipal =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-xs font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary-color)] disabled:cursor-not-allowed disabled:opacity-50'

const formatoHora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })

/** «10:30» → «10:30 a. m.» */
export function hora12(hora: string): string {
  const [h, m] = hora.split(':').map(Number)
  return formatoHora.format(new Date(Date.UTC(2000, 0, 1, h, m))).replace(/\s/g, ' ')
}

function personasTexto(n: number) {
  return `${n} ${n === 1 ? 'persona' : 'personas'}`
}

/** Horas del día según el horario de la sede (modo WhatsApp: sin consultar la base). */
function horasDelHorario(horario: HorarioSemana | null, fecha: string, intervalo: number, desdeMinutos: number | null): string[] {
  if (!horario || !fecha) return []
  const [y, m, d] = fecha.split('-').map(Number)
  const dia = DIAS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]
  const salida: string[] = []
  for (const t of turnosDe(horario[dia])) {
    const inicio = aMinutos(t.abre)
    let fin = aMinutos(t.cierra)
    if (fin <= inicio) fin += 24 * 60
    // Hasta una hora antes del cierre (el turno de la mesa).
    for (let min = inicio; min <= fin - 60 && min < 24 * 60; min += Math.max(15, intervalo)) {
      if (desdeMinutos !== null && min <= desdeMinutos) continue
      salida.push(horaDeMinutos(min))
    }
  }
  return Array.from(new Set(salida)).sort()
}

function Campo({ id, etiqueta, children, className }: { id: string; etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {etiqueta}
      </label>
      {children}
    </div>
  )
}

function Leyenda() {
  const muestra = (estilo: React.CSSProperties) => <span className="inline-block h-3 w-3 rounded-[3px] border" style={estilo} aria-hidden="true" />
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        {muestra({ borderColor: 'var(--text-color)', backgroundColor: 'var(--background-color)' })}
        Disponible
      </li>
      <li className="flex items-center gap-1.5">
        {muestra({ borderColor: 'var(--text-color)', backgroundColor: 'var(--text-color)' })}
        Tu selección
      </li>
      <li className="flex items-center gap-1.5">
        {muestra({ borderColor: 'color-mix(in srgb, var(--text-color) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--text-color) 10%, var(--background-color))' })}
        No disponible a esa hora
      </li>
    </ul>
  )
}

export function ReservaPlano(props: ReservaPlanoProps) {
  const { reserva: opciones, sedes } = props
  const base = useId().replace(/:/g, '')
  const formRef = useRef<HTMLFormElement>(null)
  const { extras } = useEncabezadoPie()
  const enlaceWhatsapp = extras.enlaces.whatsapp

  // ── Sede: ?sede=, la recordada en la carta (E7) o la primera ──
  const [sedeId, setSedeId] = useState<number | null>(sedes[0]?.id ?? null)
  useEffect(() => {
    try {
      const pedida = Number(new URLSearchParams(window.location.search).get('sede'))
      const recordada = Number(window.localStorage.getItem(CLAVE_SEDE_RECORDADA))
      const elegida = sedes.find((s) => s.id === pedida) ?? sedes.find((s) => s.id === recordada)
      if (elegida) setSedeId(elegida.id)
    } catch {
      /* sin URL o almacenamiento: la primera */
    }
  }, [sedes])
  const sede = sedes.find((s) => s.id === sedeId) ?? sedes[0] ?? null
  // Modo WhatsApp sin número configurado: si la sede acepta reservas, directo al ERP.
  const modo: ModoReserva = sede?.modo === 'whatsapp' && !enlaceWhatsapp ? 'erp' : sede?.modo ?? 'erp'
  const ajustes = sede?.ajustes ?? null
  const zona = sede?.zonaHoraria ?? 'America/Bogota'
  const baseAjustes = ajustes ?? AJUSTES_RESERVA_POR_DEFECTO
  const { min: minPersonas, max: maxPersonas } = limitesPersonas(ajustes, props.minGuests, props.maxGuests)
  const diasMax = Math.max(0, Math.min(baseAjustes.maxDiasAnticipacion, props.maxDays ?? baseAjustes.maxDiasAnticipacion))

  // ── Fecha, hora y personas ──
  const [hoy, setHoy] = useState<string | null>(null)
  useEffect(() => setHoy(hoyEnZona(zona)), [zona])
  const fechas = useMemo(() => (hoy ? Array.from({ length: diasMax + 1 }, (_, i) => sumarDias(hoy, i)) : []), [hoy, diasMax])
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [personas, setPersonas] = useState(Math.min(Math.max(2, minPersonas), maxPersonas))
  useEffect(() => {
    if (hoy && (!fecha || !fechas.includes(fecha))) setFecha(hoy)
  }, [hoy, fecha, fechas])
  useEffect(() => {
    if (personas < minPersonas) setPersonas(minPersonas)
    else if (personas > maxPersonas) setPersonas(maxPersonas)
  }, [personas, minPersonas, maxPersonas])

  // ── Mesa ──
  const zonasPlano = useMemo(() => {
    const p = sede?.plano
    if (!p) return []
    const nombres = new Set(p.mesas.filter((m) => m.x !== null).map((m) => m.zona).filter((z): z is string => !!z))
    return [...nombres].map((n) => ({ nombre: n, mesas: p.mesas.filter((m) => m.zona === n).length }))
  }, [sede])
  const [zonaVista, setZonaVista] = useState<string | null>(null)
  useEffect(() => setZonaVista(zonasPlano.length > 1 ? zonasPlano[0].nombre : null), [zonasPlano])
  const plano = useMemo(() => (sede?.plano ? (zonaVista ? planoConZonas(sede.plano, [zonaVista]) : sede.plano) : null), [sede, zonaVista])
  const [mesaId, setMesaId] = useState<string | null>(null)
  const [asignaEquipo, setAsignaEquipo] = useState(false)
  const mesa = sede?.plano?.mesas.find((m) => m.id === mesaId) ?? null

  // ── Datos ──
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const [acepta, setAcepta] = useState(false)
  const politica = ajustes?.politica ?? props.policyText
  const requiereTelefono = modo === 'whatsapp' ? true : ajustes?.requiereTelefono ?? true
  const requiereEmail = props.requireEmail || ajustes?.requiereEmail === true
  const grupoGrande = ajustes?.grupoGrande ?? null

  // ── Horas: disponibilidad de la sede (ERP) o su horario (WhatsApp) ──
  const flujo = useReservaMesa({
    organizationId: props.organizationId,
    branchId: sede?.id ?? null,
    slotInterval: String(baseAjustes.intervaloMinutos),
    errorMessage: 'No se pudo completar la reserva. Inténtalo de nuevo.',
    origen: 'ReservaPlano',
    limpiarFranjas: true,
  })
  const { checkAvailability } = flujo
  useEffect(() => {
    setHora('')
    if (modo === 'erp' && fecha) void checkAvailability(fecha, '', personas, null)
  }, [modo, fecha, personas, sede?.id, checkAvailability])
  const horas = useMemo(() => {
    if (modo === 'erp') return flujo.availableSlots.filter((s) => s.available).map((s) => s.time)
    const desde = fecha && hoy && fecha === hoy ? ahoraEnZona(zona).minutos : null
    return horasDelHorario(sede?.horario ?? null, fecha, baseAjustes.intervaloMinutos, desde)
  }, [modo, flujo.availableSlots, sede, fecha, hoy, zona, baseAjustes.intervaloMinutos])

  // ── Disponibilidad por mesa (solo ERP, con fecha, hora y personas) ──
  const [disponibles, setDisponibles] = useState<Record<string, EstadoMesaWeb> | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [avisoMesa, setAvisoMesa] = useState<string | null>(null)
  useEffect(() => {
    setDisponibles(null)
    if (modo !== 'erp' || !sede?.plano || !fecha || !hora) return
    const control = new AbortController()
    const params = new URLSearchParams({ organizationId: String(props.organizationId), branchId: String(sede.id), date: fecha, time: hora, partySize: String(personas) })
    setConsultando(true)
    fetch(`/api/restaurant-reservations/mesas?${params}`, { signal: control.signal })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setDisponibles(leerDisponibilidadMesas(Object.entries(d?.mesas ?? {}).map(([table_id, estado]) => ({ table_id, estado })))))
      .catch(() => {
        /* sin respuesta: el plano sigue con lo que se sabe sin consultar */
      })
      .finally(() => setConsultando(false))
    return () => control.abort()
  }, [modo, sede, fecha, hora, personas, props.organizationId])

  const estados = useMemo(() => {
    const salida: Record<string, EstadoMesaWeb> = {}
    for (const m of sede?.plano?.mesas ?? []) {
      const local = estadoSinConsulta(m, personas)
      salida[m.id] = local !== 'libre' ? local : disponibles?.[m.id] ?? 'libre'
    }
    return salida
  }, [sede, personas, disponibles])

  // La mesa elegida dejó de servir (otra hora, más personas o alguien la tomó): se sugieren otras (E4).
  const sugeridas = useMemo(() => {
    if (!mesa || estados[mesa.id] === 'libre') return []
    // Forma de la RPC (`MesaPlano` del contrato) ida y vuelta.
    const comoRpc = (m: MesaDelPlano) => ({ id: m.id, name: m.nombre, zone: m.zona, capacity: m.capacidad, mesa: m })
    const libres = (sede?.plano?.mesas ?? []).filter((m) => estados[m.id] === 'libre').map(comoRpc)
    return mesasMasParecidas(comoRpc(mesa), libres, personas).map((x) => x.mesa)
  }, [mesa, estados, sede, personas])
  useEffect(() => {
    if (mesa && estados[mesa.id] !== 'libre') {
      setAvisoMesa(`La ${mesa.nombre} ya no está disponible a esa hora o para ${personasTexto(personas)}.`)
    } else {
      setAvisoMesa(null)
    }
  }, [mesa, estados, personas])

  const esperandoHora = opciones.askTimeFirst && modo === 'erp' && !hora
  const elegir = useCallback((m: MesaDelPlano) => {
    setMesaId((actual) => (actual === m.id ? null : m.id))
    setAsignaEquipo(false)
  }, [])

  // ── Envío ──
  const [enviadoWhatsapp, setEnviadoWhatsapp] = useState<{ url: string; mensaje: string; registrada: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const textoBoton = props.ctaText || TEXTO_BOTON_RESERVA[modo]
  const sinPlano = !sede?.plano?.hayPlano

  const validar = (): string | null => {
    if (!sede) return 'No hay una sede disponible para reservar.'
    if (grupoGrande !== null && personas > grupoGrande) return `Para grupos de más de ${grupoGrande} personas, escríbenos y organizamos tu mesa.`
    if (!fecha || !hora) return 'Elige la fecha y la hora.'
    if (!sinPlano && !mesa && !(opciones.tableOptional && asignaEquipo)) {
      return opciones.tableOptional ? 'Toca una mesa en el plano o elige «Que la asigne el equipo».' : 'Toca una mesa en el plano.'
    }
    if (mesa && estados[mesa.id] !== 'libre') return 'Esa mesa ya no está disponible: elige otra.'
    if (!nombre.trim()) return 'Escribe tu nombre.'
    if (requiereTelefono && !telefono.trim()) return 'El WhatsApp es obligatorio.'
    if (requiereEmail && !email.trim()) return 'El correo es obligatorio.'
    if (!telefono.trim() && !email.trim()) return 'Déjanos un WhatsApp o un correo.'
    if (telefono.trim() && !telefonoValido(telefono)) return 'El número no es válido para el país elegido.'
    if (politica && !acepta) return 'Debes aceptar la política de reservas.'
    return null
  }

  const enviar = async () => {
    setError(null)
    const fallo = validar()
    if (fallo || !sede) {
      setError(fallo)
      return
    }
    const zonaPermitida = mesa?.zona && (ajustes?.zonas ?? []).includes(mesa.zona) ? mesa.zona : null
    if (modo === 'erp') {
      await flujo.submit({
        date: fecha,
        time: hora,
        guests: personas,
        name: nombre.trim(),
        phone: telefono.trim(),
        email: email.trim(),
        notes: notaConMesa(mesa, notas) || undefined,
        zone: zonaPermitida,
      })
      return
    }
    // WhatsApp: el mensaje armado y el chat del sitio. Se abre antes de cualquier espera
    // (los navegadores bloquean ventanas abiertas después de un `await`).
    const fechaTexto = fechaLarga(fecha)
    const mensaje = mensajeReservaWhatsapp({
      sede: sede.nombre,
      fecha: fechaTexto.charAt(0).toLowerCase() + fechaTexto.slice(1),
      hora: hora12(hora),
      personas,
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      mesa: mesa?.nombre ?? null,
      zona: mesa?.zona ?? null,
      notas: notas.trim() || null,
    })
    const url = `${(enlaceWhatsapp ?? '').split('?')[0]}?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    // «Registrar también en el ERP» (E3): por el mismo POST, solo si la sede exige confirmación
    // (así queda «Por confirmar»; una sede sin confirmación la daría por confirmada sin el chat).
    const registrar = opciones.alsoRegister && ajustes?.requiereConfirmacion === true
    if (registrar) {
      void fetch('/api/restaurant-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          organizationId: props.organizationId,
          branchId: sede.id,
          date: fecha,
          time: hora,
          partySize: personas,
          name: nombre.trim(),
          phone: telefono.trim(),
          email: email.trim(),
          notes: notaConMesa(mesa, notas, NOTA_SOLICITUD_WHATSAPP),
          ...(zonaPermitida ? { zone: zonaPermitida } : {}),
          website: flujo.honeypot,
        }),
      }).catch(() => {
        /* el chat ya se abrió: la solicitud llega por WhatsApp */
      })
    } else {
      // Sin registro: la solicitud llega solo por WhatsApp (lo de la lámina 04 · A).
    }
    setEnviadoWhatsapp({ url, mensaje, registrada: registrar })
  }

  const reiniciar = () => {
    flujo.reiniciar()
    setEnviadoWhatsapp(null)
    setMesaId(null)
    setHora('')
    setNotas('')
    setAcepta(false)
    if (modo === 'erp' && fecha) void checkAvailability(fecha, '', personas, null)
  }

  if (!sede) return null

  // ── Confirmación (lámina 05 · B1/B2) o chat abierto (05 · A) ──
  const creada = flujo.status === 'success' ? flujo.reservationResult : null
  const confirmacion: ReactNode = creada ? (
    <Confirmacion
      pendiente={creada.status === 'pending'}
      mensaje={creada.status === 'pending' ? props.pendingMessage : props.successMessage}
      filas={[
        ['Código', creada.code],
        ['Sede', sede.nombre],
        ...(mesa ? ([['Mesa que pediste', `${mesa.nombre}${mesa.zona ? ` · ${mesa.zona}` : ''}`]] as [string, string][]) : []),
        ['Cuándo', `${fechaCorta(creada.date)} · ${hora12(creada.time.slice(0, 5))}`],
        ['Personas', String(creada.partySize)],
        ['Estado', creada.deposito ? 'Pendiente de pago' : creada.status === 'pending' ? 'Por confirmar' : 'Confirmada'],
      ]}
      calendario={enlacesCalendario(creada, zona, `Reserva en ${props.organizationName}`, [sede.nombre, sede.direccion].filter(Boolean).join(' · ') || null)}
      gestion={creada.manageUrl ?? null}
      aviso={flujo.errorMsg || null}
      onOtra={reiniciar}
    />
  ) : enviadoWhatsapp ? (
    <div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
      <span className="flex h-14 w-14 items-center justify-center rounded-full text-background" style={{ backgroundColor: 'var(--text-color)' }} aria-hidden="true">
        <MessageCircle className="h-6 w-6" />
      </span>
      <h3 className="text-2xl [font-family:var(--font-heading)]">Te abrimos WhatsApp</h3>
      <p className="text-sm text-muted-foreground">El mensaje va listo: solo toca «Enviar». La respuesta y la confirmación llegan por el mismo chat.</p>
      <blockquote className="w-full rounded-2xl border border-border p-4 text-left text-sm leading-6">{enviadoWhatsapp.mensaje}</blockquote>
      <a href={enviadoWhatsapp.url} target="_blank" rel="noopener noreferrer" {...BOTON_PRIMARIO} className={botonPrincipal} style={{ backgroundColor: 'var(--text-color)', color: 'var(--background-color)' }}>
        Abrir WhatsApp de nuevo
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
      <button type="button" onClick={reiniciar} className="text-sm underline underline-offset-4 hover:opacity-70">
        Hacer otra reserva
      </button>
    </div>
  ) : null

  const ordenPlano = opciones.planPosition === 'right' ? 'lg:order-2' : ''
  const columnas = opciones.planPosition === 'top' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]'

  const tarjetaPlano = (
    <div className={cn(tarjeta, 'flex flex-col gap-4', ordenPlano)} style={fondoTarjeta}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ backgroundColor: 'color-mix(in srgb, var(--text-color) 12%, transparent)' }}>
          Plano · {sede.nombre}
        </span>
        <span className="text-xs text-muted-foreground">
          {consultando ? 'Buscando mesas libres…' : 'Toca una mesa para elegirla'}
          <span className="md:hidden"> · pellizca para acercar</span>
        </span>
      </div>
      {zonasPlano.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Zonas">
          {zonasPlano.map((z) => (
            <button
              key={z.nombre}
              type="button"
              aria-pressed={zonaVista === z.nombre}
              onClick={() => setZonaVista(z.nombre)}
              className={cn('rounded-full border px-3 py-1 text-xs transition-colors', zonaVista === z.nombre ? 'border-transparent bg-muted font-medium text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}
            >
              {z.nombre} · {z.mesas}
            </button>
          ))}
        </div>
      )}
      {plano && !sinPlano ? (
        <div className="relative rounded-2xl p-2 md:p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--text-color) 5%, var(--background-color))' }}>
          <div className={cn(opciones.mobilePlan === 'list' && 'hidden md:block', esperandoHora && 'pointer-events-none opacity-40')} aria-hidden={esperandoHora || undefined}>
            <PlanoMesas
              plano={plano}
              estados={estados}
              elegida={mesaId}
              onElegir={elegir}
              mostrarCapacidad={opciones.showCapacity}
              atenuarPequenas={opciones.dimSmallTables}
              estilo={opciones.planStyle}
              etiqueta={`Plano de mesas de ${sede.nombre}`}
            />
          </div>
          {opciones.mobilePlan === 'list' && (
            <ul className={cn('grid grid-cols-2 gap-2 md:hidden', esperandoHora && 'pointer-events-none opacity-40')}>
              {plano.mesas.map((m) => {
                const libre = estados[m.id] === 'libre'
                const sel = m.id === mesaId
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={!libre}
                      aria-pressed={sel}
                      onClick={() => elegir(m)}
                      className={cn('w-full rounded-xl border px-3 py-2 text-left text-sm', sel ? 'border-transparent bg-foreground text-background' : 'border-border', !libre && 'opacity-40')}
                    >
                      <span className="block font-medium">{m.nombre}</span>
                      <span className="block text-xs opacity-75">{[m.zona, personasTexto(m.capacidad)].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {esperandoHora && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-medium text-foreground">Elige la fecha, la hora y las personas para ver las mesas libres.</p>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Esta sede aún no tiene plano: el equipo te asigna la mesa.</p>
      )}
      {opciones.showLegend && !sinPlano && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Leyenda />
          {opciones.showCapacity && <span className="text-xs text-muted-foreground">El número bajo el nombre es la capacidad</span>}
        </div>
      )}
      {avisoMesa && (
        <div role="status" className="rounded-xl border border-border p-3 text-sm">
          <p>{avisoMesa}</p>
          {sugeridas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Te sugerimos:</span>
              {sugeridas.map((m) => (
                <button key={m.id} type="button" onClick={() => elegir(m)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                  {resumenMesa(m)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const tarjetaFormulario = (
    <div className={cn(tarjeta, 'flex flex-col gap-4')} style={fondoTarjeta}>
      {confirmacion ?? (
        <form
          ref={formRef}
          id={`${base}-formulario`}
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <p className="flex items-center gap-2 text-base font-medium">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {sede.nombre}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo id={`${base}-fecha`} etiqueta="Fecha">
              <select id={`${base}-fecha`} className={campo} value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={fechas.length === 0}>
                {fechas.map((f, i) => (
                  <option key={f} value={f}>
                    {i === 0 ? `Hoy · ${fechaCorta(f)}` : i === 1 ? `Mañana · ${fechaCorta(f)}` : fechaCorta(f)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id={`${base}-hora`} etiqueta={flujo.availabilityLoading ? 'Hora (buscando…)' : 'Hora'}>
              {modo === 'whatsapp' && !sede.horario ? (
                <input id={`${base}-hora`} type="time" step={900} className={campo} value={hora} onChange={(e) => setHora(e.target.value)} />
              ) : (
                <select id={`${base}-hora`} className={campo} value={hora} onChange={(e) => setHora(e.target.value)} disabled={flujo.availabilityLoading || horas.length === 0}>
                  <option value="">{horas.length === 0 && !flujo.availabilityLoading ? 'Sin horas' : 'Elige'}</option>
                  {horas.map((h) => (
                    <option key={h} value={h}>
                      {hora12(h)}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
          <Campo id={`${base}-personas`} etiqueta="Personas">
            <select id={`${base}-personas`} className={campo} value={personas} onChange={(e) => setPersonas(Number(e.target.value))}>
              {Array.from({ length: maxPersonas - minPersonas + 1 }, (_, i) => i + minPersonas).map((n) => (
                <option key={n} value={n}>
                  {personasTexto(n)}
                </option>
              ))}
            </select>
          </Campo>
          {!sinPlano && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground" id={`${base}-mesa`}>
                Mesa elegida
              </span>
              <p
                aria-labelledby={`${base}-mesa`}
                aria-live="polite"
                className={cn('rounded-xl px-3.5 py-2.5 text-sm', mesa ? 'text-background' : 'border border-dashed border-border text-muted-foreground')}
                style={mesa ? { backgroundColor: 'var(--text-color)' } : undefined}
              >
                {mesa ? resumenMesa(mesa) : asignaEquipo ? 'La asigna el equipo' : 'Toca una mesa en el plano'}
              </p>
              {opciones.tableOptional && !mesa && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={asignaEquipo} onChange={(e) => setAsignaEquipo(e.target.checked)} className="h-4 w-4 accent-[var(--primary-color)]" />
                  Que la asigne el equipo
                </label>
              )}
            </div>
          )}
          <Campo id={`${base}-nombre`} etiqueta="Nombre completo">
            <input id={`${base}-nombre`} className={campo} autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo id={`${base}-tel`} etiqueta={requiereTelefono ? 'WhatsApp' : 'WhatsApp (opcional)'}>
            <TelefonoPais id={`${base}-tel`} className="rounded-xl border border-border bg-background text-sm text-foreground" required={requiereTelefono} value={telefono} onChange={setTelefono} />
          </Campo>
          {(modo === 'erp' || requiereEmail) && (
            <Campo id={`${base}-email`} etiqueta={requiereEmail ? 'Correo' : 'Correo (opcional)'}>
              <input id={`${base}-email`} type="email" className={campo} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
          )}
          {props.showNotes && (
            <Campo id={`${base}-notas`} etiqueta="Notas (opcional)">
              <textarea id={`${base}-notas`} rows={3} maxLength={300} className={cn(campo, 'resize-none')} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Cumpleaños, una silla para bebé…" />
            </Campo>
          )}
          {politica && (
            <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary-color)]" />
              <span>Acepto la política de reservas: {politica}</span>
            </label>
          )}
          {/* Honeypot del flujo de siempre: debe quedar vacío. */}
          <input type="text" name="website" value={flujo.honeypot} onChange={(e) => flujo.setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          {(error || (flujo.status !== 'idle' && flujo.status !== 'submitting' && flujo.errorMsg)) && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error || flujo.errorMsg}
              {!error && flujo.suggestedTimes.length > 0 && (
                <span className="mt-2 flex flex-wrap gap-2">
                  {flujo.suggestedTimes.slice(0, 4).map((t) => (
                    <button key={t} type="button" onClick={() => setHora(t)} className="rounded-full border border-red-300 px-2.5 py-0.5 text-xs">
                      {hora12(t)}
                    </button>
                  ))}
                </span>
              )}
            </p>
          )}
          <button type="submit" {...BOTON_PRIMARIO} disabled={flujo.status === 'submitting' || flujo.status === 'paying'} className={botonPrincipal} style={{ backgroundColor: 'var(--text-color)', color: 'var(--background-color)' }}>
            {flujo.status === 'submitting' ? 'Enviando…' : flujo.status === 'paying' ? 'Abriendo el pago…' : textoBoton}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="text-xs leading-5 text-muted-foreground">
            {modo === 'whatsapp'
              ? 'La disponibilidad se confirma por WhatsApp. Aplica solo para reservas individuales.'
              : 'Te confirmamos por WhatsApp y por correo. Al reservar aceptas la política de reservas de la sede.'}
          </p>
        </form>
      )}
    </div>
  )

  return (
    <div id={props.anchorId} className="mx-auto flex w-full max-w-7xl scroll-mt-24 flex-col gap-8 px-4 md:px-6" data-reserva-plano={modo}>
      <div className="flex max-w-3xl flex-col gap-4">
        {props.eyebrow && <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{props.eyebrow}</p>}
        {props.title && <h2 className="text-4xl leading-tight text-foreground [font-family:var(--font-heading)] md:text-6xl">{props.title}</h2>}
        {props.subtitle && <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">{props.subtitle}</p>}
        {sedes.length > 1 && (
          <div className="flex w-fit flex-wrap gap-1 rounded-full border border-border p-1" role="group" aria-label="Sede">
            {sedes.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === sede.id}
                onClick={() => {
                  setSedeId(s.id)
                  setMesaId(null)
                  try {
                    window.localStorage.setItem(CLAVE_SEDE_RECORDADA, String(s.id))
                  } catch {
                    /* sin almacenamiento */
                  }
                }}
                className={cn('min-h-10 rounded-full px-5 text-sm transition-colors', s.id === sede.id ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted')}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={cn('grid items-start gap-6', columnas)}>
        {tarjetaPlano}
        {tarjetaFormulario}
      </div>

      {/* Celular: hoja con la mesa elegida que lleva al formulario (lámina 03 · celular). */}
      {mesa && opciones.mobilePlan === 'sheet' && !confirmacion && (
        <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-border p-5 shadow-[0_-12px_30px_-18px_rgb(0_0_0/0.4)] md:hidden" style={{ backgroundColor: 'var(--background-color)' }}>
          <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted" aria-hidden="true" />
          <p className="text-xl [font-family:var(--font-heading)]">
            {mesa.nombre}
            {mesa.zona ? ` · ${mesa.zona}` : ''}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            hasta {personasTexto(mesa.capacidad)}
            {fecha ? ` · ${fechaCorta(fecha)}` : ''}
            {hora ? `, ${hora12(hora)}` : ''}
          </p>
          <button
            type="button"
            {...BOTON_PRIMARIO}
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={cn(botonPrincipal, 'mt-4')}
            style={{ backgroundColor: 'var(--text-color)', color: 'var(--background-color)' }}
          >
            Continuar con mis datos
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

function Confirmacion({
  pendiente,
  mensaje,
  filas,
  calendario,
  gestion,
  aviso,
  onOtra,
}: {
  pendiente: boolean
  mensaje: string | null
  filas: [string, string][]
  calendario: { google: string; ics: string }
  gestion: string | null
  aviso: string | null
  onOtra: () => void
}) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => titulo.current?.focus(), [])
  return (
    <div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={pendiente ? { backgroundColor: 'color-mix(in srgb, var(--text-color) 14%, var(--background-color))', color: 'var(--text-color)' } : { backgroundColor: 'var(--text-color)', color: 'var(--background-color)' }}
        aria-hidden="true"
      >
        {pendiente ? <Clock className="h-7 w-7" /> : <Check className="h-7 w-7" />}
      </span>
      <h3 ref={titulo} tabIndex={-1} className="text-3xl leading-tight outline-none [font-family:var(--font-heading)]">
        {pendiente ? 'Solicitud recibida' : '¡Tu mesa está reservada!'}
      </h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {mensaje || (pendiente ? 'El equipo de la sede la revisa y te avisa por WhatsApp y por correo en cuanto la confirme.' : 'Te esperamos. Te enviamos la confirmación por WhatsApp y por correo.')}
      </p>
      <dl className="w-full space-y-2 rounded-2xl border border-border p-4 text-left text-sm">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={k === 'Código' ? 'font-mono font-semibold' : 'text-right'}>{v}</dd>
          </div>
        ))}
      </dl>
      {aviso && <p className="text-sm text-muted-foreground">{aviso}</p>}
      <a href={calendario.ics} download="reserva.ics" {...BOTON_PRIMARIO} className={botonPrincipal} style={{ backgroundColor: 'var(--text-color)', color: 'var(--background-color)' }}>
        Agregar al calendario
      </a>
      {gestion && (
        <Link href={gestion} {...BOTON_SECUNDARIO} className={cn(botonPrincipal, 'border border-foreground/40 text-foreground')}>
          Ver o cambiar mi reserva
        </Link>
      )}
      <a href={calendario.google} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-4" style={{ color: ACENTO }}>
        Añadir a Google Calendar
      </a>
      <button type="button" onClick={onOtra} className="text-sm underline underline-offset-4 hover:opacity-70">
        Hacer otra reserva
      </button>
    </div>
  )
}
