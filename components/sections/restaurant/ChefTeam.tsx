/**
 * Sección `chef_team` — chef y equipo (Figma ChefTeam 148:7592).
 *
 * Variantes: `chef` (retrato + cita) y `team` (rejilla de integrantes).
 * Contenido editable en el editor. Es una sección nueva: no lee ni escribe
 * el contenido de `team` ni de `chef_section`. Los integrantes usan la misma
 * forma de item que `team` (`name`, `role`, `image_url`) para que copiar un
 * equipo de una sección a otra no exija rehacerlo.
 *
 * Sin 'use client': el manifiesto lee `ChefTeam.CONTENT_KEYS`.
 */

import { cardVisual, items, oneOf, str, strOr, type Content } from '@/lib/restaurant/secciones'
import { ChefTeamView, type ChefTeamVariant, type TeamMember } from './ChefTeamView'
import { EditorHint } from './EditorHint'

export const CONTENT_KEYS = [
  'eyebrow',
  'title',
  'subtitle',
  'quote',
  'name',
  'role',
  'bio',
  'image_url',
  'image_alt',
  'members',
] as const

const VARIANTS: readonly ChefTeamVariant[] = ['chef', 'team']

interface ChefTeamProps {
  content: Content
  sectionVariant?: string
}

export function ChefTeam({ content, sectionVariant }: ChefTeamProps) {
  const variant = oneOf(sectionVariant, VARIANTS, 'chef')

  if (variant === 'team') {
    const members: TeamMember[] = items(content.members)
      .map((mbr) => ({ name: str(mbr.name), role: str(mbr.role), imageUrl: str(mbr.image_url) }))
      .filter((mbr): mbr is TeamMember => mbr.name !== null)
    if (members.length === 0) {
      return <EditorHint title="Equipo sin integrantes">Agrega integrantes en «Integrantes» (nombre, cargo y foto).</EditorHint>
    }
    return (
      <ChefTeamView
        variant="team"
        eyebrow={strOr(content, 'eyebrow', 'Equipo')}
        title={str(content.title)}
        subtitle={str(content.subtitle)}
        members={members}
        mediaStyle={cardVisual(content).media}
      />
    )
  }

  const name = str(content.name)
  const quote = str(content.quote)
  if (!name && !quote) {
    return <EditorHint title="Chef sin datos">Escribe el nombre del chef y su cita en el editor.</EditorHint>
  }
  return (
    <ChefTeamView
      variant="chef"
      eyebrow={strOr(content, 'eyebrow', 'Cocina')}
      quote={quote}
      name={name}
      role={str(content.role)}
      bio={str(content.bio)}
      imageUrl={str(content.image_url)}
      imageAlt={str(content.image_alt) ?? (name ? `Retrato de ${name}` : 'Retrato del chef')}
      mediaStyle={cardVisual(content).media}
    />
  )
}

ChefTeam.CONTENT_KEYS = CONTENT_KEYS
