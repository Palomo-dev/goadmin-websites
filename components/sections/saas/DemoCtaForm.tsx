'use client'

import { ContactFormFeedback } from '../contact/ContactFormFeedback'
import {
  CONTACT_MAX_LENGTHS,
  HONEYPOT_FIELD_PROPS,
  useContactForm,
} from '../contact/useContactForm'

interface DemoCtaFormProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    show_form?: boolean
  }
  organization?: any
  primaryColor?: string
}

const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '200+']

export function DemoCtaForm({ content, organization, primaryColor }: DemoCtaFormProps) {
  const { values, setField, status, errorMessage, successMessage, submit, isSubmitting } =
    useContactForm({
      organizationId: organization?.id,
      sourceForm: 'saas_demo_cta',
      requireMessage: false,
      initialValues: { subject: 'Solicitud de demo' },
    })

  // El rango de empleados viaja dentro del mensaje del lead.
  const employees =
    EMPLOYEE_RANGES.find((range) => values.message === `Empleados: ${range}`) ?? ''

  const inputClass =
    'w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:placeholder-gray-500 focus:ring-2 focus:outline-none disabled:opacity-60'

  return (
    <div className="text-center">
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 mb-8">{content.subtitle}</p>
      )}
      {content.show_form !== false ? (
        <form className="max-w-lg mx-auto space-y-4 text-left" onSubmit={submit} noValidate>
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
              placeholder="Email corporativo"
              aria-label="Email corporativo"
              maxLength={CONTACT_MAX_LENGTHS.email}
              value={values.email}
              onChange={(e) => setField('email', e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
            />
          </div>
          <input
            type="text"
            placeholder="Empresa"
            aria-label="Empresa"
            maxLength={CONTACT_MAX_LENGTHS.company}
            value={values.company}
            onChange={(e) => setField('company', e.target.value)}
            disabled={isSubmitting}
            className={inputClass}
          />
          <select
            aria-label="¿Cuántos empleados?"
            value={employees}
            onChange={(e) => setField('message', e.target.value ? `Empleados: ${e.target.value}` : '')}
            disabled={isSubmitting}
            className={`${inputClass} dark:bg-gray-800 text-gray-500 dark:text-gray-400`}
          >
            <option value="">¿Cuántos empleados?</option>
            {EMPLOYEE_RANGES.map((range) => (
              <option key={range} value={range}>{range}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: primaryColor }}
          >
            {isSubmitting ? 'Enviando...' : content.cta_text || 'Solicitar Demo'}
          </button>
          <p className="text-xs text-gray-400 text-center">Sin compromiso. Te contactaremos en menos de 24h.</p>
        </form>
      ) : (
        <button
          type="button"
          className="px-8 py-4 rounded-lg text-white font-medium text-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          {content.cta_text || 'Solicitar Demo'}
        </button>
      )}
    </div>
  )
}
