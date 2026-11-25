'use client'

import { Fragment, useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import Link from '@/components/site/Enlace'
import { TelefonoPais } from '@/components/site/TelefonoPais'
import { CONTACT_MAX_LENGTHS, type ContactFormStatus, type ContactFormValues } from './useContactForm'
import {
  CORREO_VALIDO,
  camposFaltantes,
  camposVisibles,
  leerCamposContacto,
  type CampoContacto,
  type TipoCampoContacto,
} from '@/lib/website/v2/contrato/paginaContacto'

/**
 * CONTAC-04: «Campos del formulario» (`content.form_fields`) del formulario de contacto.
 * Sin la clave (o vacía) cada variante pinta sus campos de siempre: nada cambia en lo publicado.
 * Con campos: se pintan en ese orden. Los conocidos (nombre, correo, teléfono, asunto, empresa,
 * mensaje) van a sus columnas del CRM; los demás se añaden al mensaje como «Etiqueta: valor».
 * Nombre y correo siempre se piden (el CRM los necesita): si faltan en la lista, van primero.
 *
 * Contacto v2 (Figma 3108:85760): cada campo tiene «Mostrar» y la casilla de tratamiento de datos
 * (`consent`, con enlace a la política). La lectura y la regla de obligatorios viven en el contrato
 * (`lib/website/v2/contrato/paginaContacto.ts`), la misma que aplica /api/contact en el servidor.
 */

export type TipoCampo = TipoCampoContacto
export type CampoPropio = CampoContacto

/** Lee `form_fields` y deja los visibles; `null` = sin campos propios (la variante pinta los de siempre). */
export function camposFormulario(valor: unknown): CampoPropio[] | null {
  const campos = leerCamposContacto(valor)
  return campos ? camposVisibles(campos) : null
}

/** Mensaje de error de un campo, el mismo en el navegador y tras la respuesta del servidor. */
export function errorDeCampo(c: CampoPropio, valor: string): string {
  if (c.type === 'consent') return 'Acepta el tratamiento de datos para enviarnos el mensaje'
  if (c.estandar === 'email' && valor.trim() !== '') return 'Escribe un correo válido, como nombre@correo.com'
  if (c.estandar === 'message') return 'Cuéntanos en qué te ayudamos'
  if (c.estandar === 'name') return 'Escribe tu nombre'
  if (c.estandar === 'email') return 'Escribe tu correo'
  return `Completa «${c.label}»`
}

export function useCamposPropios(campos: CampoPropio[] | null) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [falta, setFalta] = useState<string | null>(null)
  const [errores, setErrores] = useState<string[]>([])
  const setValor = useCallback((name: string, v: string) => {
    setValores((p) => ({ ...p, [name]: v }))
    setFalta(null)
    setErrores((e) => (e.includes(name) ? e.filter((x) => x !== name) : e))
  }, [])
  const limpiar = useCallback(() => {
    setValores({})
    setErrores([])
  }, [])
  const quitarError = useCallback((name: string) => setErrores((e) => (e.includes(name) ? e.filter((x) => x !== name) : e)), [])

  /** Mensaje para el CRM: el texto del visitante más los campos propios (la casilla de datos no). */
  const componer = useCallback(
    (v: ContactFormValues) => {
      const extra = (campos ?? [])
        .filter((c) => !c.estandar && c.type !== 'consent' && (valores[c.name] ?? '').trim() !== '')
        .map((c) => `${c.label}: ${c.type === 'checkbox' ? 'Sí' : valores[c.name].trim()}`)
      let message = [v.message.trim(), ...(extra.length > 0 ? ['', ...extra] : [])].join('\n').trim()
      // Sin «mensaje» ni «asunto» en el formulario: el mensaje son los campos llenos (si no, el
      // servidor respondería «Escribe un mensaje»).
      if (!message && !v.subject.trim()) {
        message = [
          `Nombre: ${v.name.trim()}`,
          `Correo: ${v.email.trim()}`,
          ...(v.phone.trim() ? [`Teléfono: ${v.phone.trim()}`] : []),
          ...(v.company.trim() ? [`Empresa: ${v.company.trim()}`] : []),
        ].join('\n')
      }
      return { subject: v.subject, message: message.slice(0, CONTACT_MAX_LENGTHS.message) }
    },
    [campos, valores]
  )

  /** Casilla de datos y campos propios: viajan aparte para que el servidor valide los obligatorios. */
  const payload = useCallback(() => {
    const fields: Record<string, string> = {}
    for (const c of campos ?? []) {
      if (!c.estandar && c.type !== 'consent' && (valores[c.name] ?? '').trim() !== '') fields[c.name] = valores[c.name].trim().slice(0, 500)
    }
    const consentimiento = (campos ?? []).find((c) => c.type === 'consent')
    return { consent: consentimiento ? valores[consentimiento.name] === 'si' : undefined, fields }
  }, [campos, valores])

  /** Valida los obligatorios (misma regla que el servidor) y el correo antes de enviar. */
  const alEnviar = useCallback(
    (submit: (e?: { preventDefault?: () => void }) => unknown, v: ContactFormValues) => (e: FormEvent) => {
      const lista = campos ?? []
      const consentimiento = lista.find((c) => c.type === 'consent')
      const faltan = camposFaltantes(lista, {
        name: v.name, email: v.email, phone: v.phone, subject: v.subject, company: v.company, message: v.message,
        consent: consentimiento ? valores[consentimiento.name] === 'si' : undefined,
        extra: valores,
      })
      const correo = lista.find((c) => c.estandar === 'email')
      if (correo && v.email.trim() !== '' && !CORREO_VALIDO.test(v.email.trim()) && !faltan.includes(correo.name)) faltan.push(correo.name)
      if (faltan.length > 0) {
        e.preventDefault()
        setErrores(faltan)
        const primero = lista.find((c) => c.name === faltan[0])
        setFalta(primero ? `${errorDeCampo(primero, primero.estandar ? v[primero.estandar] : valores[primero.name] ?? '')}.` : null)
        return
      }
      setErrores([])
      void submit(e)
    },
    [campos, valores]
  )

  return { valores, setValor, limpiar, componer, payload, alEnviar, falta, errores, setErrores, quitarError }
}

interface CamposPropiosProps {
  campos: CampoPropio[]
  values: ContactFormValues
  setField: (field: keyof ContactFormValues, value: string) => void
  propios: ReturnType<typeof useCamposPropios>
  status: ContactFormStatus
  disabled?: boolean
  inputClass: string
  /**
   * Contacto v2: etiqueta encima de cada campo, «(opcional)», error debajo y el teléfono con país.
   * Sin esto, como antes: la etiqueta va de texto de ayuda dentro del campo.
   */
  conEtiquetas?: boolean
  /** Con etiquetas: los campos cortos de dos en dos (solo en computador). */
  dosColumnas?: boolean
  primaryColor?: string
}

function Casilla({ c, valor, cambiar, disabled, error, primaryColor }: { c: CampoPropio; valor: string; cambiar: (v: string) => void; disabled?: boolean; error?: boolean; primaryColor?: string }) {
  const enlace = c.type === 'consent' && c.link_url ? c.link_url : null
  const texto: ReactNode = c.type === 'consent' ? (
    <>
      {c.label}
      {c.link_label && (
        <>
          {' '}
          {enlace ? (
            /^https?:\/\//i.test(enlace) ? (
              <a href={enlace} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline" style={{ color: primaryColor }}>{c.link_label}</a>
            ) : (
              <Link href={enlace} className="underline-offset-2 hover:underline" style={{ color: primaryColor }}>{c.link_label}</Link>
            )
          ) : (
            c.link_label
          )}
        </>
      )}
    </>
  ) : c.label
  return (
    <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        className={`mt-0.5 h-4 w-4 shrink-0 rounded ${error ? 'outline outline-2 outline-red-600' : ''}`}
        checked={valor === 'si'}
        onChange={(e) => cambiar(e.target.checked ? 'si' : '')}
        disabled={disabled}
        aria-required={c.required}
        aria-invalid={error || undefined}
      />
      <span>
        {texto}
        {c.required && <span className="text-red-600"> *</span>}
      </span>
    </label>
  )
}

export function CamposPropios({ campos, values, setField, propios, status, disabled, inputClass, conEtiquetas = false, dosColumnas = false, primaryColor }: CamposPropiosProps) {
  const { limpiar } = propios
  useEffect(() => {
    if (status === 'success') limpiar()
  }, [status, limpiar])

  const pintar = (c: CampoPropio) => {
    const valor = c.estandar ? values[c.estandar] : propios.valores[c.name] ?? ''
    const cambiar = (v: string) => {
      if (c.estandar) {
        setField(c.estandar, v)
        propios.quitarError(c.name)
      } else {
        propios.setValor(c.name, v)
      }
    }
    const conError = propios.errores.includes(c.name)
    const etiqueta = c.required ? `${c.label} *` : c.label
    const max = c.estandar ? CONTACT_MAX_LENGTHS[c.estandar] : 500
    const idCampo = `campo-${c.name}`
    const clase = `${inputClass} ${conError ? 'border-red-600 dark:border-red-500' : ''}`
    const ayuda = conEtiquetas ? (c.placeholder || undefined) : etiqueta

    if (c.type === 'checkbox' || c.type === 'consent') {
      const casilla = <Casilla key={c.name} c={c} valor={valor} cambiar={cambiar} disabled={disabled} error={conError} primaryColor={primaryColor} />
      if (!conEtiquetas) return casilla
      return (
        <div key={c.name} className="flex flex-col gap-1">
          {casilla}
          {conError && <ErrorCampo>{errorDeCampo(c, valor)}</ErrorCampo>}
        </div>
      )
    }

    let control: ReactNode
    if (c.type === 'textarea') {
      control = (
        <textarea id={idCampo} placeholder={ayuda} aria-label={conEtiquetas ? undefined : c.label} aria-required={c.required} aria-invalid={conError || undefined} rows={4} maxLength={max} value={valor}
          onChange={(e) => cambiar(e.target.value)} disabled={disabled} className={`${clase} resize-none`} />
      )
    } else if (c.type === 'select' && c.options.length > 0) {
      control = (
        <select id={idCampo} aria-label={conEtiquetas ? undefined : c.label} aria-required={c.required} aria-invalid={conError || undefined} value={valor} onChange={(e) => cambiar(e.target.value)} disabled={disabled} className={clase}>
          <option value="">{conEtiquetas ? (c.placeholder || 'Elige una opción') : etiqueta}</option>
          {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    } else if (conEtiquetas && c.estandar === 'phone') {
      control = (
        <TelefonoPais
          aria-label={c.label}
          value={valor}
          onChange={(v) => cambiar(v)}
          disabled={disabled}
          className={`rounded-lg border bg-background text-foreground ${conError ? 'border-red-600' : 'border-border'}`}
        />
      )
    } else {
      control = (
        <input id={idCampo} type={c.type === 'select' ? 'text' : c.type} placeholder={ayuda} aria-label={conEtiquetas ? undefined : c.label} aria-required={c.required} aria-invalid={conError || undefined} maxLength={max}
          value={valor} onChange={(e) => cambiar(e.target.value)} disabled={disabled} className={clase} />
      )
    }
    if (!conEtiquetas) return <Fragment key={c.name}>{control}</Fragment>
    return (
      <div key={c.name} className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={idCampo} className="text-sm font-medium text-gray-900 dark:text-white">
          {c.label}
          {c.required ? <span className="text-red-600"> *</span> : <span className="font-normal text-gray-400"> (opcional)</span>}
        </label>
        {control}
        {conError && <ErrorCampo>{errorDeCampo(c, valor)}</ErrorCampo>}
      </div>
    )
  }

  if (!conEtiquetas) {
    return (
      <>
        {propios.falta && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{propios.falta}</p>
        )}
        {campos.map(pintar)}
      </>
    )
  }

  // Con etiquetas: los campos cortos seguidos van de dos en dos (Nombre · Correo, Teléfono · Asunto).
  const corto = (c: CampoPropio) => dosColumnas && c.type !== 'textarea' && c.type !== 'checkbox' && c.type !== 'consent'
  const filas: CampoPropio[][] = []
  for (const c of campos) {
    const ultima = filas[filas.length - 1]
    if (corto(c) && ultima && ultima.length === 1 && corto(ultima[0])) ultima.push(c)
    else filas.push([c])
  }
  return (
    <>
      {filas.map((fila) =>
        fila.length === 2 ? (
          <div key={fila[0].name} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {fila.map(pintar)}
          </div>
        ) : (
          pintar(fila[0])
        )
      )}
    </>
  )
}

function ErrorCampo({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
      <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      {children}
    </p>
  )
}
