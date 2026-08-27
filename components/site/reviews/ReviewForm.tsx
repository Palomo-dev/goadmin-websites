'use client'

/**
 * FASE 10.2 — Formulario para escribir una reseña.
 * Mantiene el diseño del formulario original.
 * En modo `generated` es decorativo (no persiste); en modo `real` debería
 * enviar a /api/reviews (pendiente de F10.5 flujo de captura).
 */

import { useState } from 'react'
import { Star, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReviewFormProps {
  primaryColor: string
  onSubmit?: (data: { name: string; comment: string; rating: number }) => void
}

export function ReviewForm({ primaryColor, onSubmit }: ReviewFormProps) {
  const [formData, setFormData] = useState({ name: '', comment: '', rating: 5 })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(formData)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 5000)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mb-8 p-6 border rounded-xl bg-white shadow-sm">
        <h3 className="font-semibold text-lg mb-4">Tu opinión</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Calificación</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFormData(d => ({ ...d, rating: i }))}
                >
                  <Star className={`h-7 w-7 ${i <= formData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': primaryColor } as any}
              placeholder="Tu nombre"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Comentario</label>
            <textarea
              value={formData.comment}
              onChange={e => setFormData(d => ({ ...d, comment: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 min-h-[100px]"
              style={{ '--tw-ring-color': primaryColor } as any}
              placeholder="Cuéntanos tu experiencia con este producto..."
              required
            />
          </div>
          <Button type="submit" style={{ backgroundColor: primaryColor }} className="text-white">
            <Send className="h-4 w-4 mr-2" />
            Enviar opinión
          </Button>
        </div>
      </form>

      {submitted && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ¡Gracias por tu opinión! Será publicada después de ser revisada.
        </div>
      )}
    </>
  )
}
