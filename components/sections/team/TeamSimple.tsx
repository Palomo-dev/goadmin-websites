'use client'

interface TeamSimpleProps {
  content: Record<string, any>
  primaryColor?: string
}

export function TeamSimple({ content, primaryColor = '#3B82F6' }: TeamSimpleProps) {
  const title = content.title || 'Nuestro Equipo'
  const members = content.members || []

  return (
    <section className="py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10">{title}</h2>}
        <div className="space-y-4">
          {members.map((m: any, i: number) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-gray-500">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
