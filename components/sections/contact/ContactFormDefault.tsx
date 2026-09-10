'use client'

import { ContactFormFeedback } from './ContactFormFeedback'
import { CONTACT_MAX_LENGTHS, HONEYPOT_FIELD_PROPS, useContactForm } from './useContactForm'

interface ContactFormDefaultProps {
  content: {
    title?: string
    subtitle?: string
  }
  organization: any
  primaryColor?: string
}

export function ContactFormDefault({ content, organization, primaryColor }: ContactFormDefaultProps) {
  const { values, setField, status, errorMessage, successMessage, submit, isSubmitting } =
    useContactForm({ organizationId: organization?.id, sourceForm: 'contact_form_default' })

  const inputClass =
    'w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:placeholder-gray-500 focus:outline-none focus:ring-2 disabled:opacity-60'

  return (
    <div className="max-w-2xl mx-auto">
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      <form className="space-y-4" onSubmit={submit} noValidate>
        <ContactFormFeedback status={status} errorMessage={errorMessage} successMessage={successMessage} />

        {/* Campo trampa anti-bots */}
        <input
          {...HONEYPOT_FIELD_PROPS}
          value={values.website}
          onChange={(e) => setField('website', e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            required
            placeholder="Nombre"
            aria-label="Nombre"
            maxLength={CONTACT_MAX_LENGTHS.name}
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            disabled={isSubmitting}
            className={inputClass}
            style={{ '--tw-ring-color': primaryColor } as any}
          />
          <input
            type="email"
            required
            placeholder="Email"
            aria-label="Email"
            maxLength={CONTACT_MAX_LENGTHS.email}
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            disabled={isSubmitting}
            className={inputClass}
          />
        </div>
        <input
          type="text"
          placeholder="Asunto"
          aria-label="Asunto"
          maxLength={CONTACT_MAX_LENGTHS.subject}
          value={values.subject}
          onChange={(e) => setField('subject', e.target.value)}
          disabled={isSubmitting}
          className={inputClass}
        />
        <textarea
          placeholder="Mensaje"
          aria-label="Mensaje"
          rows={5}
          maxLength={CONTACT_MAX_LENGTHS.message}
          value={values.message}
          onChange={(e) => setField('message', e.target.value)}
          disabled={isSubmitting}
          className={`${inputClass} resize-none`}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: primaryColor || '#8B6914' }}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
        </button>
      </form>
    </div>
  )
}
