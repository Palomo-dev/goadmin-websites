interface TrainersGridProps {
  content: {
    title?: string
    subtitle?: string
    members?: Array<{
      name: string
      role?: string
      bio?: string
      image_url?: string
      specialties?: string[]
    }>
  }
  primaryColor?: string
}

export function TrainersGrid({ content, primaryColor }: TrainersGridProps) {
  const members = content.members || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      {members.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {members.map((member, i) => (
            <div key={i} className="text-center group">
              <div className="w-40 h-40 rounded-full overflow-hidden mx-auto mb-4 border-4 border-transparent group-hover:border-current transition-colors" style={{ color: primaryColor }}>
                {member.image_url ? (
                  <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-4xl">🏋️</div>
                )}
              </div>
              <h3 className="font-bold text-lg">{member.name}</h3>
              {member.role && <p className="text-gray-500 text-sm mb-2">{member.role}</p>}
              {member.specialties && member.specialties.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {member.specialties.map((s, j) => (
                    <span key={j} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p className="text-4xl mb-3">🏋️</p>
          <p>Entrenadores próximamente</p>
        </div>
      )}
    </div>
  )
}
