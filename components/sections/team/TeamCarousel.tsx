'use client'

import { useState } from 'react'

interface TeamCarouselProps {
  content: Record<string, any>
  primaryColor?: string
}

export function TeamCarousel({ content, primaryColor = '#3B82F6' }: TeamCarouselProps) {
  const title = content.title || 'Nuestro Equipo'
  const members = content.members || []
  const [current, setCurrent] = useState(0)

  if (members.length === 0) return null

  const member = members[current]

  return (
    <section className="py-16 px-4">
      <div className="max-w-3xl mx-auto text-center">
        {title && <h2 className="text-3xl font-bold mb-10 text-gray-900 dark:text-white">{title}</h2>}
        <div className="mb-6">
          {member.photo_url ? (
            <img src={member.photo_url} alt={member.name} className="w-32 h-32 rounded-full mx-auto object-cover mb-4" />
          ) : (
            <div className="w-32 h-32 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold mb-4" style={{ backgroundColor: primaryColor }}>
              {member.name?.[0] || '?'}
            </div>
          )}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{member.name}</h3>
          <p className="text-sm font-medium mb-2" style={{ color: primaryColor }}>{member.role}</p>
          {member.bio && <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">{member.bio}</p>}
        </div>
        {members.length > 1 && (
          <div className="flex gap-2 justify-center">
            {members.map((_: any, i: number) => (
              <button key={i} onClick={() => setCurrent(i)} className="w-3 h-3 rounded-full transition-all" style={{ backgroundColor: i === current ? primaryColor : '#D1D5DB' }} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
