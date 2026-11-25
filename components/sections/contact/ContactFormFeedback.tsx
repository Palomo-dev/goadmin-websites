'use client'

import type { ContactFormStatus, EnvioContacto } from './useContactForm'
import { textoConDatos } from '@/lib/website/v2/contrato/paginaContacto'

/** «Texto del botón» de la sección; vacío = el de siempre de la variante. */
export function textoBoton(valor: unknown, porDefecto: string): string {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, 40) : porDefecto
}

/**
 * Contacto v2: título y texto de enviado propios (con {nombre} y {correo}). Sin ellos, el mensaje
 * del servidor, como siempre.
 */
export function mensajeExito(content: unknown, delServidor: string, envio: EnvioContacto | null): string {
  const c = (content ?? {}) as { success_title?: unknown; success_text?: unknown }
  const titulo = typeof c.success_title === 'string' ? c.success_title.trim() : ''
  const texto = typeof c.success_text === 'string' ? c.success_text.trim() : ''
  if (!titulo && !texto) return delServidor
  return textoConDatos([titulo, texto].filter(Boolean).join(' '), { nombre: envio?.name, correo: envio?.email })
}

interface ContactFormFeedbackProps {
  status: ContactFormStatus
  errorMessage: string
  successMessage: string
}

/**
 * Aviso honesto del resultado del envío.
 * Solo se muestra "recibido" cuando el servidor confirmó que se guardó.
 */
export function ContactFormFeedback({
  status,
  errorMessage,
  successMessage,
}: ContactFormFeedbackProps) {
  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
      >
        {successMessage}
      </div>
    )
  }

  if (status === 'error' && errorMessage) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
      >
        {errorMessage}
      </div>
    )
  }

  return null
}
