'use client'

import type { ContactFormStatus } from './useContactForm'

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
