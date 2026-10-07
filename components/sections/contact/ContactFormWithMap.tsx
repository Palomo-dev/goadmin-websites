'use client'

import { ContactFormFeedback } from './ContactFormFeedback'
import { CONTACT_MAX_LENGTHS, HONEYPOT_FIELD_PROPS, useContactForm } from './useContactForm'
import { TelefonoPais } from '@/components/site/TelefonoPais'

interface ContactFormWithMapProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
}

export function ContactFormWithMap({ content, organization, primaryColor = '#3B82F6' }: ContactFormWithMapProps) {
  const { title, subtitle, show_phone, show_email, show_address } = content
  // «Mostrar mapa» del inspector. Ausente = se muestra: es la variante «Con mapa».
  const showMap = content.show_map !== false
  const address = organization?.address || ''
  const query = encodeURIComponent(address)

  const { values, setField, status, errorMessage, successMessage, submit, isSubmitting } =
    useContactForm({ organizationId: organization?.id, sourceForm: 'contact_form_with_map' })

  const inputClass =
    'px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:placeholder-gray-500 focus:ring-2 focus:outline-none disabled:opacity-60'

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{title}</h2>}
        {subtitle && <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{subtitle}</p>}
        <div className={`grid grid-cols-1 ${showMap ? 'lg:grid-cols-2' : 'max-w-2xl mx-auto'} gap-8`}>
          <form
            className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 space-y-4"
            onSubmit={submit}
            noValidate
          >
            <ContactFormFeedback status={status} errorMessage={errorMessage} successMessage={successMessage} />

            {/* Campo trampa anti-bots */}
            <input
              {...HONEYPOT_FIELD_PROPS}
              value={values.website}
              onChange={(e) => setField('website', e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <TelefonoPais
              aria-label="Teléfono"
              value={values.phone}
              onChange={(v) => setField('phone', v)}
              disabled={isSubmitting}
              className="rounded-lg border border-border bg-background text-foreground"
            />
            <textarea
              rows={4}
              placeholder="Mensaje"
              aria-label="Mensaje"
              maxLength={CONTACT_MAX_LENGTHS.message}
              value={values.message}
              onChange={(e) => setField('message', e.target.value)}
              disabled={isSubmitting}
              className={`w-full ${inputClass} resize-none`}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar mensaje'}
            </button>
          </form>
          {showMap && (
            <div className="rounded-xl overflow-hidden min-h-[300px]">
              <iframe
                src={`https://maps.google.com/maps?q=${query}&output=embed`}
                className="w-full h-full border-0 min-h-[300px]"
                allowFullScreen
                loading="lazy"
              />
            </div>
          )}
        </div>
        {(show_phone || show_email || show_address) && (
          <div className="flex flex-wrap gap-8 justify-center mt-8 text-sm text-gray-600 dark:text-gray-400">
            {show_phone && organization?.phone && <span>📞 {organization.phone}</span>}
            {show_email && organization?.email && <span>✉️ {organization.email}</span>}
            {show_address && address && <span>📍 {address}</span>}
          </div>
        )}
      </div>
    </section>
  )
}
