'use client'

import { Lock, ShieldAlert, CreditCard, XCircle, Trash2 } from 'lucide-react'
import type { FrozenReason } from '@/lib/get-org-context'

interface FrozenAccountNoticeProps {
  reason: FrozenReason
  primaryColor: string
  organizationName: string
  organizationEmail?: string | null
  organizationPhone?: string | null
}

const config: Record<Exclude<FrozenReason, null>, {
  icon: typeof Lock
  iconBg: string
  iconColor: string
  title: string
  subtitle: string
  description: string
}> = {
  trial_expired: {
    icon: Lock,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'El período de prueba ha finalizado',
    subtitle: 'El sitio no está disponible temporalmente.',
    description: 'El tiempo de prueba gratuito de esta organización ha expirado. El administrador necesita seleccionar un plan para reactivar el sitio.',
  },
  suspended: {
    icon: ShieldAlert,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    title: 'Cuenta suspendida',
    subtitle: 'El sitio no está disponible.',
    description: 'Esta organización ha sido suspendida. Contacta al administrador o soporte para más información.',
  },
  deleted: {
    icon: Trash2,
    iconBg: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    title: 'Cuenta eliminada',
    subtitle: 'El sitio ya no existe.',
    description: 'Esta organización ha sido eliminada del sistema.',
  },
  payment_failed: {
    icon: CreditCard,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Pago pendiente',
    subtitle: 'El sitio no está disponible temporalmente.',
    description: 'Hubo un problema con el pago de la suscripción. El administrador necesita actualizar el método de pago para reactivar el sitio.',
  },
  canceled: {
    icon: XCircle,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    title: 'Suscripción cancelada',
    subtitle: 'El sitio no está disponible.',
    description: 'La suscripción de esta organización ha sido cancelada. Contacta al administrador para reactivarla.',
  },
}

export function FrozenAccountNotice({
  reason,
  primaryColor,
  organizationName,
  organizationEmail,
  organizationPhone
}: FrozenAccountNoticeProps) {
  if (!reason) return null

  const c = config[reason]
  const Icon = c.icon

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${c.iconBg}`}>
          <Icon className={`w-8 h-8 ${c.iconColor}`} />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {c.title}
        </h1>

        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
          {c.subtitle}
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          {c.description}
        </p>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 mb-6">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Organización</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{organizationName}</p>
        </div>

        {(organizationEmail || organizationPhone) && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 dark:text-gray-500">¿Necesitas ayuda? Contacta al administrador:</p>
            {organizationEmail && (
              <a
                href={`mailto:${organizationEmail}`}
                className="inline-block text-sm font-medium hover:underline"
                style={{ color: primaryColor }}
              >
                {organizationEmail}
              </a>
            )}
            {organizationPhone && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{organizationPhone}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
