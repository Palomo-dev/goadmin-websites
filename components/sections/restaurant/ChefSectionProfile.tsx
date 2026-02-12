interface ChefSectionProfileProps {
  content: {
    title?: string
    name?: string
    role?: string
    bio?: string
    image_url?: string
    quote?: string
  }
  primaryColor?: string
}

export function ChefSectionProfile({ content, primaryColor }: ChefSectionProfileProps) {
  return (
    <div className="flex flex-col md:flex-row items-center gap-10">
      <div className="w-full md:w-2/5">
        {content.image_url ? (
          <img src={content.image_url} alt={content.name || 'Chef'} className="w-full rounded-2xl shadow-lg" loading="lazy" />
        ) : (
          <div className="aspect-[3/4] bg-gray-100 rounded-2xl flex items-center justify-center text-6xl">👨‍🍳</div>
        )}
      </div>
      <div className="flex-1">
        {content.title && (
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>
            {content.title}
          </p>
        )}
        <h2 className="text-3xl md:text-4xl font-bold mb-2">{content.name || 'Nuestro Chef'}</h2>
        {content.role && <p className="text-gray-500 text-lg mb-4">{content.role}</p>}
        {content.bio && <p className="text-gray-700 leading-relaxed mb-6">{content.bio}</p>}
        {content.quote && (
          <blockquote className="border-l-4 pl-4 italic text-gray-600" style={{ borderColor: primaryColor }}>
            &ldquo;{content.quote}&rdquo;
          </blockquote>
        )}
      </div>
    </div>
  )
}
