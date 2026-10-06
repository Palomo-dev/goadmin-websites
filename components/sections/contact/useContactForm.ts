'use client'

import { useCallback, useState } from 'react'

/**
 * Lógica compartida por los formularios de contacto públicos.
 *
 * Envía a POST /api/contact, que crea/reutiliza el `customers` (lifecycle_stage
 * 'lead') y crea la `opportunities` con record_type 'lead'.
 *
 * Reglas:
 *  - Nunca se muestra "Mensaje recibido" si el servidor no confirmó el guardado.
 *  - Los errores se muestran al visitante, no se tragan.
 *  - `website` es un honeypot: está oculto y debe quedar vacío.
 */

export type ContactFormStatus = 'idle' | 'submitting' | 'success' | 'error'

export interface ContactFormValues {
  name: string
  email: string
  phone: string
  subject: string
  company: string
  message: string
  /** Honeypot anti-bots: oculto para personas, tentador para robots. */
  website: string
}

const EMPTY: ContactFormValues = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  company: '',
  message: '',
  website: '',
}

export const CONTACT_MAX_LENGTHS = {
  name: 120,
  email: 160,
  phone: 40,
  subject: 200,
  company: 160,
  message: 4000,
} as const

interface UseContactFormOptions {
  /** Id de la organización del sitio. El servidor lo verifica contra el host. */
  organizationId?: number | string | null
  /** Identifica qué formulario originó el lead (queda en la oportunidad). */
  sourceForm: string
  /** Campos obligatorios además de nombre y correo. */
  requireMessage?: boolean
  /** Valores de partida (p. ej. un asunto fijo). Se restauran al limpiar. */
  initialValues?: Partial<ContactFormValues>
  /**
   * Formularios con campos propios (p. ej. cotización de evento privado):
   * arma el asunto y el mensaje que se envían a /api/contact a partir de
   * esos campos. Sin esta opción se envían `subject` y `message` tal cual.
   */
  composeMessage?: (values: ContactFormValues) => { subject?: string; message: string }
  /**
   * Datos estructurados opcionales que viajan además del texto (p. ej. la sede
   * y los detalles del evento privado). El servidor valida la sede contra la
   * organización del host y sanea `details` con una lista blanca.
   */
  extraPayload?: (values: ContactFormValues) => { branchId?: number | null; details?: Record<string, unknown> } | undefined
}

export function useContactForm({
  organizationId,
  sourceForm,
  requireMessage = true,
  initialValues,
  composeMessage,
  extraPayload,
}: UseContactFormOptions) {
  // Sin dependencias reactivas a propósito: los valores de partida son fijos.
  const [baseValues] = useState<ContactFormValues>(() => ({ ...EMPTY, ...initialValues }))
  const [values, setValues] = useState<ContactFormValues>(baseValues)
  const [status, setStatus] = useState<ContactFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const setField = useCallback(
    (field: keyof ContactFormValues, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }))
      setStatus((prev) => (prev === 'error' ? 'idle' : prev))
    },
    []
  )

  const reset = useCallback(() => {
    setValues(baseValues)
    setStatus('idle')
    setErrorMessage('')
    setSuccessMessage('')
  }, [baseValues])

  const submit = useCallback(
    async (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.()
      if (status === 'submitting') return

      const name = values.name.trim()
      const email = values.email.trim()
      const composed = composeMessage?.(values)
      const message = (composed ? composed.message : values.message).trim()
      const subject = (composed ? composed.subject ?? '' : values.subject).trim()

      if (!name || !email) {
        setStatus('error')
        setErrorMessage('Escribe tu nombre y tu correo.')
        return
      }
      if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email)) {
        setStatus('error')
        setErrorMessage('El correo no es válido.')
        return
      }
      if (requireMessage && !message && !subject) {
        setStatus('error')
        setErrorMessage('Escribe un mensaje.')
        return
      }

      setStatus('submitting')
      setErrorMessage('')

      const extra = extraPayload?.(values)

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: organizationId ?? undefined,
            name,
            email,
            phone: values.phone.trim() || undefined,
            subject: subject || undefined,
            company: values.company.trim() || undefined,
            message,
            sourceForm,
            ...(extra?.branchId ? { branchId: extra.branchId } : {}),
            ...(extra?.details ? { details: extra.details } : {}),
            website: values.website, // honeypot
          }),
        })

        const data = await res.json().catch(() => null)

        if (!res.ok || !data?.success) {
          setStatus('error')
          setErrorMessage(
            data?.error || 'No pudimos enviar tu mensaje. Inténtalo de nuevo.'
          )
          return
        }

        setStatus('success')
        setSuccessMessage(data.message || 'Mensaje recibido. Te contactaremos pronto.')
        setValues(baseValues)
      } catch {
        setStatus('error')
        setErrorMessage('No hay conexión con el servidor. Inténtalo de nuevo.')
      }
    },
    [baseValues, composeMessage, extraPayload, organizationId, requireMessage, sourceForm, status, values]
  )

  return {
    values,
    setField,
    status,
    errorMessage,
    successMessage,
    submit,
    reset,
    isSubmitting: status === 'submitting',
  }
}

/** Campo trampa: invisible para personas, visible para bots. */
export const HONEYPOT_FIELD_PROPS = {
  type: 'text' as const,
  name: 'website',
  tabIndex: -1,
  autoComplete: 'off' as const,
  'aria-hidden': true,
  style: {
    position: 'absolute' as const,
    left: '-9999px',
    width: '1px',
    height: '1px',
    opacity: 0,
  },
}
