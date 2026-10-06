'use client'

/**
 * Vista cliente de `chef_team` (Figma 148:7303 / 148:7318 y móviles).
 *
 * Movimiento (notas 149:8129 y 149:8215):
 *  - chef: la cita se ilumina palabra a palabra con el scroll; retrato con
 *    parallax ≤ 15 % (no en móvil).
 *  - team: tarjetas con fade-up y stagger 80 ms; zoom 1.05 de la foto en hover.
 *  - prefers-reduced-motion: texto estático, sin parallax ni animación.
 */

import { useEffect, useRef, useState } from 'react'
import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SiteImage } from './SiteImage'
import { SectionHeading } from './SectionHeading'
import { prefersReducedMotion, useParallax, useSectionMotion } from './useSectionMotion'
import m from './motion.module.css'

export type ChefTeamVariant = 'chef' | 'team'

export interface TeamMember {
  name: string
  role: string | null
  imageUrl: string | null
}

type ChefTeamViewProps =
  | {
      variant: 'chef'
      eyebrow: string | null
      quote: string | null
      name: string | null
      role: string | null
      bio: string | null
      imageUrl: string | null
      imageAlt: string
      mediaStyle: React.CSSProperties
    }
  | {
      variant: 'team'
      eyebrow: string | null
      title: string | null
      subtitle: string | null
      members: TeamMember[]
      mediaStyle: React.CSSProperties
    }

const ACCENT = 'var(--accent-color, var(--primary-color))'

export function ChefTeamView(props: ChefTeamViewProps) {
  return props.variant === 'team' ? <Team {...props} /> : <Chef {...props} />
}

/** Cuántas palabras de la cita están «encendidas» según el scroll. */
function useWordProgress(total: number) {
  const ref = useRef<HTMLQuoteElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [lit, setLit] = useState(total)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    setEnabled(true)
    let frame = 0
    const update = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // 0 cuando la cita asoma por abajo; 1 cuando su centro llega al 40 % superior.
      const start = vh
      const end = vh * 0.4
      const center = rect.top + rect.height / 2
      const progress = Math.max(0, Math.min(1, (start - center) / (start - end)))
      setLit(Math.round(progress * total))
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [total])

  return { ref, enabled, lit }
}

function Chef(props: Extract<ChefTeamViewProps, { variant: 'chef' }>) {
  const words = props.quote ? props.quote.split(/\s+/).filter(Boolean) : []
  const { ref, enabled, lit } = useWordProgress(words.length)
  const parallaxRef = useParallax<HTMLDivElement>(0.15)
  const signature = [props.name, props.role].filter(Boolean).join(' · ')

  return (
    <figure className="grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,560fr)_minmax(0,640fr)] md:gap-20">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted md:aspect-auto md:h-[680px]" style={props.mediaStyle}>
        <div ref={parallaxRef} className="absolute inset-0 will-change-transform">
          <SiteImage src={props.imageUrl} alt={props.imageAlt} sizes="(min-width: 768px) 45vw, 100vw" />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {props.eyebrow && (
          <p className="text-xs font-medium uppercase leading-4 tracking-[0.12em]" style={{ color: ACCENT }}>
            {props.eyebrow}
          </p>
        )}
        {words.length > 0 && (
          <>
            <Quote className="h-8 w-8" style={{ color: ACCENT }} aria-hidden="true" />
            <blockquote
              ref={ref}
              data-motion={enabled ? 'on' : 'off'}
              className="text-2xl font-bold leading-8 text-foreground [font-family:var(--font-heading)] md:text-4xl md:leading-10"
            >
              <p aria-label={`«${props.quote}»`}>
                <span aria-hidden="true">
                  {'«'}
                  {words.map((w, i) => (
                    <span key={i} className={m.word} data-lit={i < lit ? 'true' : 'false'}>
                      {w}
                      {i < words.length - 1 ? ' ' : ''}
                    </span>
                  ))}
                  {'»'}
                </span>
              </p>
            </blockquote>
          </>
        )}
        {signature && <figcaption className="text-base font-medium leading-6 text-foreground">{signature}</figcaption>}
        {props.bio && <p className="whitespace-pre-line text-base leading-6 text-muted-foreground">{props.bio}</p>}
      </div>
    </figure>
  )
}

function Team(props: Extract<ChefTeamViewProps, { variant: 'team' }>) {
  const { ref, motionProps } = useSectionMotion<HTMLDivElement>()
  return (
    <div ref={ref} {...motionProps} className="flex flex-col gap-8">
      <SectionHeading eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {props.members.map((member, i) => (
          <li
            key={`${member.name}-${i}`}
            className={cn('flex flex-col items-center gap-3 text-center', m.fadeUp, m.zoomHost)}
            style={{ '--i': i } as React.CSSProperties}
          >
            <div className="relative aspect-[7/8] w-full overflow-hidden rounded-xl" style={props.mediaStyle}>
              {member.imageUrl ? (
                <div className={cn('absolute inset-0', m.zoomImg)}>
                  <SiteImage src={member.imageUrl} alt={member.name} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
                </div>
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-5xl font-bold [font-family:var(--font-heading)]"
                  style={{ color: 'var(--primary-color)' }}
                  aria-hidden="true"
                >
                  <span className="absolute inset-0 opacity-[0.12]" style={{ backgroundColor: 'var(--primary-color)' }} />
                  <span className="relative">{member.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold leading-7 text-foreground [font-family:var(--font-heading)] md:text-xl">{member.name}</h3>
            {member.role && <p className="-mt-2 text-sm leading-5 text-muted-foreground">{member.role}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
