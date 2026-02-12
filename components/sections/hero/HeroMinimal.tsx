interface HeroMinimalProps {
  content: {
    title?: string
    subtitle?: string
  }
  primaryColor?: string
}

export function HeroMinimal({ content, primaryColor }: HeroMinimalProps) {
  return (
    <div className="text-center py-4">
      <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: primaryColor }}>
        {content.title || 'Título'}
      </h1>
      {content.subtitle && (
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          {content.subtitle}
        </p>
      )}
    </div>
  )
}
