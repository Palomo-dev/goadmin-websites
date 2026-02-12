import Link from 'next/link'

interface HeroVideoProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    video_url?: string
    image_url?: string
    overlay_opacity?: number
  }
  primaryColor?: string
}

export function HeroVideo({ content, primaryColor }: HeroVideoProps) {
  const overlayOpacity = content.overlay_opacity ?? 0.6

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {content.video_url ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          poster={content.image_url || undefined}
        >
          <source src={content.video_url} type="video/mp4" />
        </video>
      ) : content.image_url ? (
        <img src={content.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gray-900" />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }} />
      <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
        {content.title && (
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight mb-4">{content.title}</h1>
        )}
        {content.subtitle && (
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">{content.subtitle}</p>
        )}
        {content.cta_text && content.cta_url && (
          <Link
            href={content.cta_url}
            className="inline-block px-8 py-4 rounded-lg text-white font-medium text-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            {content.cta_text}
          </Link>
        )}
      </div>
    </div>
  )
}
