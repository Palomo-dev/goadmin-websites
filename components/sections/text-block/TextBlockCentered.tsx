import { claseAlineacion, claseDivisor } from './alineacion'

interface TextBlockCenteredProps {
  content: {
    title?: string
    body?: string
    content?: string
    show_divider?: boolean
  }
  primaryColor?: string
}

export function TextBlockCentered({ content, primaryColor }: TextBlockCenteredProps) {
  return (
    <div className={`max-w-3xl mx-auto text-center ${claseAlineacion(content)}`}>
      {content.title && (
        <h2 className="titulo-legado text-2xl md:text-3xl font-bold mb-4 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.show_divider && (
        <div className={`w-16 h-1 mx-auto mb-6 rounded ${claseDivisor(content)}`} style={{ backgroundColor: primaryColor }} />
      )}
      {(content.body || content.content) && (
        <div className="text-gray-600 dark:text-gray-300 leading-relaxed prose prose-lg dark:prose-invert mx-auto" dangerouslySetInnerHTML={{ __html: content.body || content.content || '' }} />
      )}
    </div>
  )
}
