'use client'

/**
 * `contact_form` · `card_hours` — «Tarjeta con horario al lado» (Contacto v2, Figma 3105:84692,
 * estados 3106:85570 / 3106:85591 / 3106:85663 / 3106:85717).
 *
 * El formulario en una tarjeta y, al lado (debajo en el celular): «Horario de atención», «¿Ya
 * hiciste un pedido?» y, si se enciende, los datos de contacto. Mismo envío que las demás
 * variantes (`useContactForm` → /api/contact, que crea el cliente potencial en el CRM, valida los
 * obligatorios con la regla de la sección y manda la copia al «A qué correo llega»).
 */

import { useEffect, useMemo, useRef } from 'react'
import { AlertCircle, ArrowUpRight, Check, Clock, Mail, MapPin, MessageCircle, Phone, Send, ShieldCheck } from 'lucide-react'
import Link from '@/components/site/Enlace'
import { cn } from '@/lib/utils'
import { HONEYPOT_FIELD_PROPS, useContactForm, type ContactFormValues } from './useContactForm'
import { CamposPropios, useCamposPropios } from './CamposPropios'
import { textoBoton } from './ContactFormFeedback'
import {
  TEXTO_ENVIADO,
  TITULO_ENVIADO,
  camposDeSeccion,
  camposVisibles,
  datosContactoDe,
  textoConDatos,
} from '@/lib/website/v2/contrato/paginaContacto'
import { whatsappDe } from '@/lib/website/menuInferior'
import { urlLlamar } from '@/lib/maps/comoLlegar'
import { filasHorario, normalizarDias, parseHorario, ZONA_POR_DEFECTO, type HorarioSemana } from '@/lib/restaurant/horario'
import { OpenStatusBadge, useEstadosEnVivo } from '@/components/sections/restaurant/EstadoApertura'
import type { SedesRestaurante } from '@/lib/restaurant/sedes-modelo'

interface Props {
  content: Record<string, unknown>
  organization: any
  primaryColor?: string
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string | number
}

function txt(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function encendido(v: unknown, porDefecto: boolean): boolean {
  return typeof v === 'boolean' ? v : porDefecto
}

function esSedes(v: unknown): v is SedesRestaurante {
  return typeof v === 'object' && v !== null && Array.isArray((v as { sedes?: unknown }).sedes)
}

/** Horario del sitio (Configuración › Contacto) o, si no hay, el de la sede principal. */
function horarioAtencion(ajustes: { business_hours?: unknown } | null | undefined, data: Record<string, unknown> | undefined, zonaOrg: string | null): { horario: HorarioSemana; zona: string } | null {
  const delSitio = parseHorario(normalizarDias(ajustes?.business_hours))
  const sedes = esSedes(data?.sedesRestaurante) ? data.sedesRestaurante : null
  const zona = zonaOrg || sedes?.zonaOrganizacion || ZONA_POR_DEFECTO
  if (delSitio) return { horario: delSitio, zona }
  const principal = sedes?.sedes.find((s) => s.esPrincipal) ?? sedes?.sedes[0]
  const deSede = principal?.horario ?? null
  return deSede ? { horario: deSede, zona: principal?.zonaHoraria || zona } : null
}

export function ContactFormTarjeta({ content, organization, primaryColor = '#3B82F6', data, sectionVariant, sectionId }: Props) {
  const campos = useMemo(() => {
    const todos = camposDeSeccion(content, sectionVariant ?? 'card_hours')
    return todos ? camposVisibles(todos) : []
  }, [content, sectionVariant])
  const propios = useCamposPropios(campos)
  const form = useContactForm({
    organizationId: organization?.id,
    sourceForm: 'contact_form_card',
    sectionId,
    requireMessage: false,
    composeMessage: (v: ContactFormValues) => propios.componer(v),
    extraPayload: () => propios.payload(),
  })
  const { values, setField, status, errorMessage, submit, isSubmitting, fieldErrors, lastSent, reset } = form
  const { setErrores } = propios

  // Errores que marcó el servidor (misma regla): se pintan en cada campo.
  useEffect(() => {
    if (fieldErrors.length > 0) setErrores(fieldErrors)
  }, [fieldErrors, setErrores])

  const ajustes = organization?.website_settings ?? null
  const datos = datosContactoDe(organization, ajustes)
  const whatsapp = datos.whatsapp ? whatsappDe(datos.whatsapp) : null
  const titulo = txt(content.title)
  const subtitulo = txt(content.subtitle)
  const centrado = content.title_align === 'center'
  const enTarjeta = encendido(content.form_in_card, true)
  const conHorario = encendido(content.show_hours, true)
  const conPedido = encendido(content.show_order_card, true)
  const conDatos = encendido(content.show_contact_info, false)
  const notaPrivacidad = encendido(content.show_privacy_note, true)
  const whatsappAlTerminar = encendido(content.whatsapp_after, true)
  const ancla = /^[a-z0-9][a-z0-9_-]*$/i.test(txt(content.anchor_id)) ? txt(content.anchor_id) : undefined

  const atencion = conHorario ? horarioAtencion(ajustes, data, typeof organization?.timezone === 'string' ? organization.timezone : null) : null
  const estados = useEstadosEnVivo(atencion ? [{ id: 0, horario: atencion.horario, zonaHoraria: atencion.zona }] : [])
  const estado = estados?.get(0) ?? null
  const lado = (atencion !== null) || conPedido || (conDatos && (datos.telefono || datos.correo || datos.direccion))

  const tarjeta = 'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-8'
  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white'

  const exito = status === 'success'
  const panelExito = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (exito) panelExito.current?.focus()
  }, [exito])

  const cuerpo = exito ? (
    <div ref={panelExito} tabIndex={-1} role="status" className="flex flex-col items-center gap-4 py-6 text-center outline-none">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
        <Check aria-hidden="true" className="h-8 w-8" strokeWidth={2.5} />
      </span>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
        {textoConDatos(txt(content.success_title) || TITULO_ENVIADO, { nombre: lastSent?.name, correo: lastSent?.email })}
      </h3>
      <p className="max-w-xl text-gray-600 dark:text-gray-300">
        {textoConDatos(txt(content.success_text) || TEXTO_ENVIADO, { nombre: lastSent?.name, correo: lastSent?.email })}
      </p>
      {lastSent && (lastSent.message || lastSent.subject) && (
        <div className="w-full rounded-lg bg-gray-50 p-4 text-left text-sm dark:bg-gray-800">
          <p className="font-medium text-gray-500 dark:text-gray-400">
            Tu mensaje{lastSent.subject ? ` · Asunto: ${lastSent.subject}` : ''}
          </p>
          {lastSent.message && (
            <p className="mt-1 text-gray-800 dark:text-gray-200">
              «{lastSent.message.length > 140 ? `${lastSent.message.slice(0, 140)}…` : lastSent.message}»
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {whatsappAlTerminar && whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-semibold text-white hover:opacity-90" style={{ backgroundColor: primaryColor }}>
            <MessageCircle aria-hidden="true" className="h-5 w-5" />
            Escribir por WhatsApp
          </a>
        )}
        <button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800">
          Enviar otro mensaje
        </button>
      </div>
    </div>
  ) : (
    <form className="flex flex-col gap-4" onSubmit={propios.alEnviar(submit, values)} noValidate>
      {(status === 'error' && errorMessage) || propios.errores.length > 0 ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">No pudimos enviar tu mensaje</p>
            <p className="text-red-700 dark:text-red-400">
              {propios.errores.length > 0 ? 'Revisa los campos marcados. Lo que escribiste no se borra.' : `${errorMessage} Lo que escribiste no se borra.`}
            </p>
          </div>
        </div>
      ) : null}
      <input {...HONEYPOT_FIELD_PROPS} value={values.website} onChange={(e) => setField('website', e.target.value)} />
      <CamposPropios
        campos={campos}
        values={values}
        setField={setField}
        propios={propios}
        status={status}
        disabled={isSubmitting}
        inputClass={inputClass}
        conEtiquetas
        dosColumnas={encendido(content.two_columns, true)}
        primaryColor={primaryColor}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: primaryColor }}
        >
          <Send aria-hidden="true" className="h-4 w-4" />
          {isSubmitting ? 'Enviando…' : textoBoton(content.button_text, 'Enviar mensaje')}
        </button>
        {notaPrivacidad && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
            No compartimos tus datos. Protegido contra spam.
          </p>
        )}
      </div>
      {status === 'error' && whatsapp && datos.whatsapp && (
        <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-green-600" />
          <span>
            ¿Sigue sin funcionar?{' '}
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline">
              Escríbenos por WhatsApp al {datos.whatsapp}
            </a>
            .
          </span>
        </p>
      )}
    </form>
  )

  return (
    <div id={ancla} className={cn('grid grid-cols-1 gap-6', lado && 'lg:grid-cols-[minmax(0,1fr)_360px]')}>
      <div className={cn(enTarjeta ? tarjeta : '', 'min-w-0')}>
        {!exito && (titulo || subtitulo) && (
          <div className={cn('mb-6', centrado && 'text-center')}>
            {titulo && <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{titulo}</h2>}
            {subtitulo && <p className="mt-2 text-gray-600 dark:text-gray-300">{subtitulo}</p>}
          </div>
        )}
        {cuerpo}
      </div>
      {lado && (
        <aside className="flex flex-col gap-6">
          {atencion && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <Clock aria-hidden="true" className="h-5 w-5" style={{ color: primaryColor }} />
                  Horario de atención
                </h3>
                {estado?.apertura && <OpenStatusBadge apertura={estado.apertura} />}
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                {filasHorario(atencion.horario, estado?.hoy ?? null).map((f) => (
                  <div key={f.etiqueta} className={cn('flex justify-between gap-4', f.esHoy && 'font-medium')}>
                    <dt className="text-gray-700 dark:text-gray-300">{f.etiqueta}</dt>
                    <dd className={f.horas ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>{f.horas ?? 'Cerrado'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {conPedido && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="font-semibold text-gray-900 dark:text-white">¿Ya hiciste un pedido?</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Mira en qué va con tu número de pedido, sin escribirnos.</p>
              <Link href="/consultar-pedido" className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800">
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                Consultar mi pedido
              </Link>
            </div>
          )}
          {conDatos && (datos.telefono || datos.correo || datos.direccion) && (
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-700 dark:bg-gray-900">
              {datos.telefono && (
                <p className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {urlLlamar(datos.telefono) ? <a href={urlLlamar(datos.telefono) ?? undefined} className="hover:underline">{datos.telefono}</a> : datos.telefono}
                </p>
              )}
              {datos.correo && (
                <p className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${datos.correo}`} className="break-all hover:underline">{datos.correo}</a>
                </p>
              )}
              {datos.direccion && (
                <p className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  {datos.direccion}
                </p>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
