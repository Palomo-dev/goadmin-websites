'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CONTACT_MAX_LENGTHS, type ContactFormStatus, type ContactFormValues } from './useContactForm'

/**
 * CONTAC-04: «Campos del formulario» (`content.form_fields`) del formulario de contacto.
 * Sin la clave (o vacía) cada variante pinta sus campos de siempre: nada cambia en lo publicado.
 * Con campos: se pintan en ese orden. Los conocidos (nombre, correo, teléfono, asunto, empresa,
 * mensaje) van a sus columnas del CRM; los demás se añaden al mensaje como «Etiqueta: valor».
 * Nombre y correo siempre se piden (el CRM los necesita): si faltan en la lista, van primero.
 */

export type TipoCampo = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox'
export interface CampoPropio {
  name: string
  label: string
  type: TipoCampo
  required: boolean
  options: string[]
  /** Columna estándar del CRM, o null si es un campo propio. */
  estandar: Exclude<keyof ContactFormValues, 'website'> | null
}

const ALIAS: Record<string, CampoPropio['estandar']> = {
  name: 'name', nombre: 'name', email: 'email', correo: 'email', phone: 'phone', telefono: 'phone', 'teléfono': 'phone', celular: 'phone',
  subject: 'subject', asunto: 'subject', company: 'company', empresa: 'company', message: 'message', mensaje: 'message',
}
const TIPOS: TipoCampo[] = ['text', 'email', 'tel', 'textarea', 'select', 'checkbox']

function opcionesDe(v: unknown): string[] {
  const lista = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n]/) : []
  return lista
    .map((o) => (typeof o === 'string' ? o : o && typeof o === 'object' ? String((o as { label?: unknown; value?: unknown }).label ?? (o as { value?: unknown }).value ?? '') : ''))
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 30)
}

/** Lee `form_fields`; `null` = sin campos propios (la variante pinta los de siempre). */
export function camposFormulario(valor: unknown): CampoPropio[] | null {
  if (!Array.isArray(valor)) return null
  const vistos = new Set<string>()
  const campos: CampoPropio[] = []
  for (const item of valor.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue
    const it = item as Record<string, unknown>
    const label = typeof it.label === 'string' ? it.label.trim().slice(0, 80) : ''
    const name = (typeof it.name === 'string' && it.name.trim() ? it.name.trim() : label).toLowerCase().slice(0, 40)
    if (!name || vistos.has(name)) continue
    const type = TIPOS.includes(it.type as TipoCampo) ? (it.type as TipoCampo) : 'text'
    const estandar = ALIAS[name] ?? null
    if (estandar && campos.some((c) => c.estandar === estandar)) continue
    vistos.add(name)
    campos.push({ name, label: label || name, type, required: it.required === true || estandar === 'name' || estandar === 'email', options: opcionesDe(it.options), estandar })
  }
  if (campos.length === 0) return null
  if (!campos.some((c) => c.estandar === 'email')) campos.unshift({ name: 'email', label: 'Email', type: 'email', required: true, options: [], estandar: 'email' })
  if (!campos.some((c) => c.estandar === 'name')) campos.unshift({ name: 'name', label: 'Nombre', type: 'text', required: true, options: [], estandar: 'name' })
  return campos
}

export function useCamposPropios(campos: CampoPropio[] | null) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [falta, setFalta] = useState<string | null>(null)
  const setValor = useCallback((name: string, v: string) => {
    setValores((p) => ({ ...p, [name]: v }))
    setFalta(null)
  }, [])
  const limpiar = useCallback(() => setValores({}), [])

  /** Mensaje para el CRM: el texto del visitante más los campos propios. */
  const componer = useCallback(
    (v: ContactFormValues) => {
      const extra = (campos ?? [])
        .filter((c) => !c.estandar && (valores[c.name] ?? '').trim() !== '')
        .map((c) => `${c.label}: ${c.type === 'checkbox' ? 'Sí' : valores[c.name].trim()}`)
      const message = [v.message.trim(), ...(extra.length > 0 ? ['', ...extra] : [])].join('\n').trim().slice(0, CONTACT_MAX_LENGTHS.message)
      return { subject: v.subject, message }
    },
    [campos, valores]
  )

  /** Valida los obligatorios propios antes de enviar (los estándar los valida el envío de siempre). */
  const alEnviar = useCallback(
    (submit: (e?: { preventDefault?: () => void }) => unknown, v: ContactFormValues) => (e: FormEvent) => {
      const vacio = (campos ?? []).find((c) => c.required && (c.estandar ? (v[c.estandar] ?? '').trim() === '' : (valores[c.name] ?? '').trim() === ''))
      if (vacio && vacio.estandar !== 'name' && vacio.estandar !== 'email') {
        e.preventDefault()
        setFalta(`Completa «${vacio.label}».`)
        return
      }
      void submit(e)
    },
    [campos, valores]
  )

  return { valores, setValor, limpiar, componer, alEnviar, falta }
}

interface CamposPropiosProps {
  campos: CampoPropio[]
  values: ContactFormValues
  setField: (field: keyof ContactFormValues, value: string) => void
  propios: ReturnType<typeof useCamposPropios>
  status: ContactFormStatus
  disabled?: boolean
  inputClass: string
}

export function CamposPropios({ campos, values, setField, propios, status, disabled, inputClass }: CamposPropiosProps) {
  const { limpiar } = propios
  useEffect(() => {
    if (status === 'success') limpiar()
  }, [status, limpiar])
  return (
    <>
      {propios.falta && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{propios.falta}</p>
      )}
      {campos.map((c) => {
        const valor = c.estandar ? values[c.estandar] : propios.valores[c.name] ?? ''
        const cambiar = (v: string) => (c.estandar ? setField(c.estandar, v) : propios.setValor(c.name, v))
        const etiqueta = c.required ? `${c.label} *` : c.label
        const max = c.estandar ? CONTACT_MAX_LENGTHS[c.estandar] : 500
        if (c.type === 'textarea') {
          return (
            <textarea key={c.name} placeholder={etiqueta} aria-label={c.label} aria-required={c.required} rows={4} maxLength={max} value={valor}
              onChange={(e) => cambiar(e.target.value)} disabled={disabled} className={`${inputClass} resize-none`} />
          )
        }
        if (c.type === 'select' && c.options.length > 0) {
          return (
            <select key={c.name} aria-label={c.label} aria-required={c.required} value={valor} onChange={(e) => cambiar(e.target.value)} disabled={disabled} className={inputClass}>
              <option value="">{etiqueta}</option>
              {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )
        }
        if (c.type === 'checkbox') {
          return (
            <label key={c.name} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={valor === 'si'} onChange={(e) => cambiar(e.target.checked ? 'si' : '')} disabled={disabled} />
              {etiqueta}
            </label>
          )
        }
        return (
          <input key={c.name} type={c.type === 'select' ? 'text' : c.type} placeholder={etiqueta} aria-label={c.label} aria-required={c.required} maxLength={max}
            value={valor} onChange={(e) => cambiar(e.target.value)} disabled={disabled} className={inputClass} />
        )
      })}
    </>
  )
}
