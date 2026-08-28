'use client'

import { useEffect, useState } from 'react'
import { X, Copy, Check, Facebook, Twitter, MessageCircle, Link2 } from 'lucide-react'

interface ShareDialogProps {
  product: any
  open: boolean
  onClose: () => void
}

export function ShareDialog({ product, open, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/productos/${product?.uuid}`)
    }
  }, [open, product])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !product) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const shareText = encodeURIComponent(`Mira este producto: ${product.name}`)
  const encodedUrl = encodeURIComponent(shareUrl)

  const socialLinks = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: '#25D366',
      url: `https://wa.me/?text=${shareText}%20${encodedUrl}`,
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: '#1877F2',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'Twitter',
      icon: Twitter,
      color: '#1DA1F2',
      url: `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`,
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Compartir producto</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 space-y-4">
          {/* Nombre del producto */}
          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{product.name}</p>

          {/* Redes sociales */}
          <div className="flex justify-center gap-3">
            {socialLinks.map((social) => {
              const Icon = social.icon
              return (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: social.color }}
                  aria-label={`Compartir en ${social.name}`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </a>
              )
            })}
          </div>

          {/* Copiar enlace */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
            <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 outline-none truncate"
            />
            <button
              onClick={handleCopy}
              className="flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors"
              style={copied ? { color: '#22c55e' } : { color: '#3B82F6' }}
            >
              {copied ? <><Check className="h-3 w-3 inline mr-1" />Copiado</> : <><Copy className="h-3 w-3 inline mr-1" />Copiar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
