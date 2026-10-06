/** Antetítulo + título + entrada, con la tipografía de las secciones de restaurante. */

import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  eyebrow?: string | null
  title?: string | null
  subtitle?: string | null
  id?: string
  className?: string
  /** Contenido a la derecha del encabezado (flechas, enlace a Instagram…). */
  aside?: React.ReactNode
}

export function SectionHeading({ eyebrow, title, subtitle, id, className, aside }: SectionHeadingProps) {
  if (!eyebrow && !title && !subtitle && !aside) return null
  return (
    <div className={cn('flex items-end justify-between gap-6', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {eyebrow && (
          <p
            className="text-xs font-medium uppercase leading-4 tracking-[0.12em]"
            style={{ color: 'var(--accent-color, var(--primary-color))' }}
          >
            {eyebrow}
          </p>
        )}
        {title && (
          <h2
            id={id}
            className="text-2xl font-bold leading-8 text-foreground [font-family:var(--font-heading)] md:text-5xl md:leading-[48px]"
          >
            {title}
          </h2>
        )}
        {subtitle && <p className="max-w-2xl text-base leading-6 text-muted-foreground">{subtitle}</p>}
      </div>
      {aside}
    </div>
  )
}
