'use client'

import { ContactFormFeedback } from './ContactFormFeedback'
import { CONTACT_MAX_LENGTHS, HONEYPOT_FIELD_PROPS, useContactForm } from './useContactForm'
import { TelefonoPais } from '@/components/site/TelefonoPais'

interface ContactFormSplitProps {
  content: {
    title?: string
    show_map?: boolean
    show_phone?: boolean
    show_email?: boolean
    show_address?: boolean
  }
  organization: any
  primaryColor?: string
}

export function ContactFormSplit({ content, organization, primaryColor }: ContactFormSplitProps) {
  const { values, setField, status, errorMessage, successMessage, submit, isSubmitting } =
    useContactForm({ organizationId: organization?.id, sourceForm: 'contact_form_split' })

  const inputClass =
    'w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:placeholder-gray-500 focus:outline-none focus:ring-2 disabled:opacity-60'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div>
        {content.title && (
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{content.title}</h2>
        )}
        <form className="space-y-4" onSubmit={submit} noValidate>
          <ContactFormFeedback status={status} errorMessage={errorMessage} successMessage={successMessage} />

          {/* Campo trampa anti-bots */}
          <input
            {...HONEYPOT_FIELD_PROPS}
            value={values.website}
            onChange={(e) => setField('website', e.target.value)}
          />

          <input
            type="text"
            required
            placeholder="Nombre completo"
            aria-label="Nombre completo"
            maxLength={CONTACT_MAX_LENGTHS.name}
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            disabled={isSubmitting}
            className={inputClass}
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
          <TelefonoPais
            aria-label="Teléfono"
            value={values.phone}
            onChange={(v) => setField('phone', v)}
            disabled={isSubmitting}
            className="rounded-lg border border-border bg-background text-foreground"
          />
          <textarea
            placeholder="Mensaje"
            aria-label="Mensaje"
            rows={4}
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
            {isSubmitting ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Información de Contacto</h3>
        {organization.phone && (
          <div className="flex items-start gap-3">
            <span className="text-xl">📞</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Teléfono</p>
              <p className="text-gray-600 dark:text-gray-400">{organization.phone}</p>
            </div>
          </div>
        )}
        {organization.email && (
          <div className="flex items-start gap-3">
            <span className="text-xl">✉️</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Email</p>
              <p className="text-gray-600 dark:text-gray-400">{organization.email}</p>
            </div>
          </div>
        )}
        {organization.address && (
          <div className="flex items-start gap-3">
            <span className="text-xl">📍</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Dirección</p>
              <p className="text-gray-600 dark:text-gray-400">{organization.address}</p>
              {organization.city && <p className="text-gray-600 dark:text-gray-400">{organization.city}, {organization.state}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
