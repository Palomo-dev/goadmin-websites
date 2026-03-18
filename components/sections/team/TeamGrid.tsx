interface TeamMember {
  name: string
  role?: string
  image_url?: string | null
}

interface TeamGridProps {
  content: {
    title?: string
    members?: TeamMember[]
  }
  primaryColor?: string
}

export function TeamGrid({ content, primaryColor }: TeamGridProps) {
  const members = content.members || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{content.title}</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {members.map((member, i) => (
          <div key={i} className="text-center">
            <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4 bg-gray-100">
              {member.image_url ? (
                <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: primaryColor || '#8B6914' }}
                >
                  {member.name.charAt(0)}
                </div>
              )}
            </div>
            <h3 className="font-semibold text-lg">{member.name}</h3>
            {member.role && <p className="text-gray-500 dark:text-gray-400 text-sm">{member.role}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
