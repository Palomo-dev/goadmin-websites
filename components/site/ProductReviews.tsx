'use client'

import { useState, useMemo } from 'react'
import { Star, ThumbsUp, Filter, ChevronDown, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Nombres colombianos para generar reviews fake
const FIRST_NAMES = [
  'María', 'Juan', 'Carlos', 'Andrea', 'Luis', 'Diana', 'Jorge', 'Camila', 'Andrés', 'Laura',
  'Santiago', 'Valentina', 'Sebastián', 'Daniela', 'Alejandro', 'Paula', 'David', 'Natalia', 'Daniel', 'Carolina',
  'Felipe', 'Juliana', 'Nicolás', 'Marcela', 'Cristian', 'Ángela', 'Diego', 'Paola', 'Fernando', 'Mónica',
  'Sergio', 'Adriana', 'Miguel', 'Sandra', 'Javier', 'Lorena', 'Óscar', 'Tatiana', 'Ricardo', 'Isabel',
  'Gustavo', 'Lina', 'Mauricio', 'Claudia', 'César', 'Viviana', 'Rafael', 'Jennifer', 'Iván', 'Yuliana',
  'Hernán', 'Milena', 'Fabián', 'Gloria', 'Wilmer', 'Esperanza', 'Jhon', 'Leidy', 'Brayan', 'Karol',
  'Estiven', 'Yesenia', 'Harold', 'Mariana', 'Robinson', 'Catalina', 'Yeison', 'Manuela', 'Edwin', 'Luisa'
]

const LAST_NAMES = [
  'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez',
  'Romero', 'Ruiz', 'Torres', 'Ramírez', 'Flores', 'Restrepo', 'Ospina', 'Vargas', 'Castaño', 'Giraldo',
  'Ríos', 'Mejía', 'Cardona', 'Sánchez', 'Pérez', 'Gómez', 'Jiménez', 'Castro', 'Ortiz', 'Valencia',
  'Zapata', 'Quintero', 'Duque', 'Parra', 'Henao', 'Marín', 'Bedoya', 'Arango', 'Cárdenas', 'Salazar',
  'Gutiérrez', 'Montoya', 'Vélez', 'Londoño', 'Ochoa', 'Rojas', 'Medina', 'Suárez', 'Herrera', 'Pineda'
]

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Manizales',
  'Santa Marta', 'Ibagué', 'Villavicencio', 'Neiva', 'Armenia', 'Pasto', 'Montería', 'Cúcuta'
]

const POSITIVE_COMMENTS = [
  'Excelente producto, superó mis expectativas. Lo recomiendo al 100%.',
  'Muy buena calidad, llegó antes de lo esperado. Muy satisfecho con la compra.',
  'Increíble relación calidad-precio. Ya es mi segunda compra aquí.',
  'El producto es exactamente como se ve en las fotos. Muy contento.',
  'Perfecto para lo que necesitaba. El envío fue rapidísimo.',
  'Calidad premium, se nota que es original. Totalmente recomendado.',
  'Me encantó, ya lo recomendé a mis amigos y familia.',
  'Buen producto, buen precio, buen servicio. ¿Qué más se puede pedir?',
  'Llegó en perfectas condiciones. El empaque es muy bueno.',
  'Definitivamente volvería a comprar. Excelente experiencia.',
  'Muy bueno, cumple con lo prometido. Feliz con mi compra.',
  'La mejor compra que he hecho últimamente. Super recomendado.',
  'Producto de primera, no me arrepiento ni un poco.',
  'Todo perfecto, desde el pedido hasta la entrega. 5 estrellas.',
  'Quedé muy satisfecho, la calidad es impresionante.',
  'Muy buena atención al cliente, el producto llegó en tiempo récord.',
  'Es tal cual se describe, excelente acabado y materiales.',
  'Compré para regalo y la persona quedó encantada. Volveré a comprar.',
  'Increíble, no pensé que fuera tan bueno por ese precio.',
  'Llevaba tiempo buscando algo así, por fin lo encontré. Perfecto.',
  'Super cómodo y de excelente calidad. Lo uso todos los días.',
  'El mejor que he probado, sin duda. Vale cada peso.',
  'Rápido, seguro y el producto es de altísima calidad.',
  'Me sorprendió gratamente, mucho mejor de lo que esperaba.',
  'Ya van 3 meses usándolo y sigue como nuevo. Excelente durabilidad.',
  'Lo compré por las buenas opiniones y confirmo que son ciertas.',
  'Producto auténtico, se nota la calidad. Muy recomendado.',
  'Llegó antes de la fecha estimada y en perfectas condiciones.',
  'Excelente compra, mi familia también quiere uno igual.',
  'La calidad es superior a productos similares que he probado.',
  'Muy satisfecho, el producto funciona perfectamente.',
  'Excelente acabado, se nota que es de buena calidad.',
  'Llegó muy rápido, el producto es excelente.',
  'Recomendado 100%, vale la pena.',
  'El producto es genial, lo uso constantemente.',
  'Muy buena compra, superó mis expectativas.',
  'Calidad excelente, envío rápido. Todo perfecto.',
  'Lo compré para mí y me encantó. Excelente.',
  'El mejor producto de su categoría. Muy bueno.',
  'Increíble calidad, superó todas mis expectativas.',
  'Muy bien hecho, los materiales son excelentes.',
  'Llegó en tiempo y forma, producto excelente.',
  'Estoy muy feliz con esta compra. Lo recomiendo.',
  'El producto es de muy buena calidad, duradero.',
  'Excelente servicio y producto de primera.',
  'Muy contento, vale cada centavo pagado.',
  'El diseño es hermoso y la calidad impecable.',
  'Sin dudas, una de mis mejores compras.',
  'Producto excelente, la calidad es inmejorable.',
  'Muy buena experiencia de compra, repetiré seguro.',
  'El producto es increíble, lo amo totalmente.',
  'Llegó rápido y en perfectas condiciones. 10/10.',
  'Calidad superior, se nota que es original.',
  'Muy feliz con mi compra, lo recomiendo mucho.',
  'El producto es perfecto, exactamente lo que quería.',
  'Excelente relación calidad-precio. Muy satisfecho.',
  'Todo fue perfecto, desde el pedido hasta la entrega.',
  'Muy buena calidad, el producto es duradero.',
  'Excelente, cumple con todo lo prometido.',
  'Llegó en perfecto estado, muy buena calidad.',
  'Estoy muy satisfecho, lo recomiendo ampliamente.',
  'El producto es excelente, muy buena inversión.',
  'Calidad premium, se nota en cada detalle.',
  'Muy buen producto, envío rápido y seguro.',
  'Lo recomiendo al 100%, excelente calidad.',
  'Perfecto, justo lo que necesitaba.',
]

const NEUTRAL_COMMENTS = [
  'Buen producto en general, aunque el envío tardó un poco más de lo esperado.',
  'Cumple con lo básico, está bien por el precio que tiene.',
  'Decente, esperaba un poco más pero no está mal.',
  'El producto está bien, el empaque podría mejorar.',
  'Buena relación calidad-precio, aunque hay cosas por mejorar.',
  'Está bien, nada extraordinario pero cumple su función.',
  'El producto es aceptable, la calidad es regular.',
  'Para el precio está bien, pero esperaba mejor acabado.',
  'Cumple lo prometido, aunque no me encantó del todo.',
  'Es un producto normal, ni bueno ni malo.',
  'La calidad es decente, pero el envío pudo ser mejor.',
  'Está bien para uso ocasional, no para uso intensivo.',
  'El producto cumple, pero hay detalles que mejorar.',
  'No es lo mejor que he comprado, pero tampoco lo peor.',
  'Es aceptable, aunque el precio podría ser menor.',
  'Funciona bien, aunque el diseño podría mejorar.',
  'La calidad es regular, pero sirve para lo básico.',
  'Está bien, esperaba más durabilidad.',
  'Cumple su propósito, sin más ni menos.',
  'Es un producto estándar, nada especial.',
  'El producto cumple su función, aunque el diseño es básico.',
  'La calidad es aceptable para el precio que tiene.',
  'Está bien, pero hay productos mejores en el mercado.',
  'Cumple con lo necesario, sin más ni menos.',
  'El envío fue normal, el producto está bien.',
  'Para el precio que tiene, es aceptable.',
  'No es malo, pero tampoco excelente.',
  'El producto funciona, aunque esperaba más.',
  'La calidad es regular, pero sirve.',
]

const NEGATIVE_COMMENTS = [
  'El producto está bien pero el envío demoró bastante.',
  'Esperaba un poco más de calidad por el precio, pero cumple.',
  'No cumplió mis expectativas, la calidad es baja.',
  'El producto llegó dañado, muy decepcionado.',
  'El material es de mala calidad, no lo recomiendo.',
  'El envío fue terrible, tardó mucho.',
  'No vale la pena, mejor comprar otra marca.',
  'El producto no dura nada, muy frágil.',
  'La descripción no coincide con lo recibido.',
  'Pésima experiencia, no volvería a comprar.',
  'El producto tiene fallas desde el primer uso.',
  'Mala calidad, se sintió barato al tacto.',
  'El empaque llegó roto y el producto dañado.',
  'No es lo que esperaba, muy decepcionado.',
  'El servicio al cliente fue pésimo.',
  'El producto no funciona como debería.',
  'La calidad es inferior a productos similares.',
  'Llegó tarde y en malas condiciones.',
  'No lo recomiendo, mejor opción en el mercado.',
  'El precio no justifica la calidad del producto.',
  'El producto no funcionó desde el primer día.',
  'Muy mala experiencia, no lo recomiendo para nada.',
  'La calidad es pésima, se rompió rápido.',
  'El envío tardó demasiado y el producto llegó mal.',
  'No es lo que muestra la foto, muy diferente.',
  'El material es de muy baja calidad, decepcionante.',
  'Pésimo servicio al cliente, no resolvieron nada.',
  'El producto tiene defectos de fábrica.',
  'No vale la pena, mejor buscar otra opción.',
]

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateReviews(productId: number, count: number = 1047) {
  const reviews = []
  const baseDate = new Date('2024-01-15')

  for (let i = 0; i < count; i++) {
    // Usar múltiples seeds para más aleatoriedad
    const seed1 = productId * 10000 + i
    const seed2 = productId * 5000 + i * 3
    const seed3 = productId * 2000 + i * 7
    const seed4 = productId * 1000 + i * 13
    const seed5 = productId * 500 + i * 17

    const rand = seededRandom(seed1)
    const rand2 = seededRandom(seed2)
    const rand3 = seededRandom(seed3)
    const rand4 = seededRandom(seed4)
    const rand5 = seededRandom(seed5)

    // Rating distribution: 76% 5stars, 20% 4stars, 3% 3stars, 1% 2-1stars (promedio ~4.7)
    let rating: number
    if (rand < 0.76) rating = 5
    else if (rand < 0.96) rating = 4
    else if (rand < 0.99) rating = 3
    else if (rand < 0.995) rating = 2
    else rating = 1

    const firstName = FIRST_NAMES[Math.floor(rand2 * FIRST_NAMES.length)]
    const lastName = LAST_NAMES[Math.floor(rand3 * LAST_NAMES.length)]
    const city = CITIES[Math.floor(rand4 * CITIES.length)]

    let comment: string
    if (rating >= 4) {
      comment = POSITIVE_COMMENTS[Math.floor(rand5 * POSITIVE_COMMENTS.length)]
    } else if (rating === 3) {
      comment = NEUTRAL_COMMENTS[Math.floor(rand5 * NEUTRAL_COMMENTS.length)]
    } else {
      comment = NEGATIVE_COMMENTS[Math.floor(rand5 * NEGATIVE_COMMENTS.length)]
    }

    // Fecha random en los últimos 18 meses
    const daysAgo = Math.floor(rand5 * 540)
    const reviewDate = new Date(baseDate)
    reviewDate.setDate(reviewDate.getDate() + Math.floor(rand2 * 540))

    const likes = Math.floor(rand3 * 50)
    const verified = rand4 > 0.2 // 80% compra verificada

    reviews.push({
      id: i + 1,
      name: `${firstName} ${lastName}`,
      city,
      rating,
      comment,
      date: reviewDate.toISOString(),
      likes,
      verified,
      avatar: `${firstName.charAt(0)}${lastName.charAt(0)}`
    })
  }

  return reviews
}

interface ProductReviewsProps {
  productId: number
  productName: string
  primaryColor: string
}

export function ProductReviews({ productId, productName, primaryColor }: ProductReviewsProps) {
  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'recent' | 'helpful'>('recent')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', comment: '', rating: 5 })
  const [submitted, setSubmitted] = useState(false)
  const ITEMS_PER_PAGE = 10

  const allReviews = useMemo(() => generateReviews(productId), [productId])

  // Stats
  const totalReviews = allReviews.length
  const avgRating = (allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: allReviews.filter(rev => rev.rating === r).length,
    percentage: Math.round((allReviews.filter(rev => rev.rating === r).length / totalReviews) * 100)
  }))

  // Filter & sort
  const filtered = useMemo(() => {
    let result = [...allReviews]
    if (filterRating !== null) {
      result = result.filter(r => r.rating === filterRating)
    }
    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } else {
      result.sort((a, b) => b.likes - a.likes)
    }
    return result
  }, [allReviews, filterRating, sortBy])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedReviews = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setShowForm(false)
    setTimeout(() => setSubmitted(false), 5000)
  }

  const renderStars = (rating: number, size: string = 'h-4 w-4') => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${size} ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  )

  return (
    <div className="mt-16 border-t pt-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Opiniones de clientes</h2>
          <p className="text-gray-500 mt-1">
            Más de <span className="font-semibold text-gray-700">{totalReviews.toLocaleString()}</span> opiniones verificadas
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          style={{ backgroundColor: primaryColor }}
          className="text-white"
        >
          <Send className="h-4 w-4 mr-2" />
          Escribir una opinión
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 p-6 bg-gray-50 rounded-xl">
        {/* Average rating */}
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-5xl font-bold text-gray-900">{avgRating}</span>
          <div className="mt-2">{renderStars(Math.round(Number(avgRating)), 'h-5 w-5')}</div>
          <p className="text-sm text-gray-500 mt-1">Basado en {totalReviews.toLocaleString()} opiniones</p>
        </div>

        {/* Rating bars */}
        <div className="col-span-2 space-y-2">
          {ratingCounts.map(({ rating, count, percentage }) => (
            <button
              key={rating}
              onClick={() => { setFilterRating(filterRating === rating ? null : rating); setPage(1) }}
              className={`w-full flex items-center gap-3 p-1.5 rounded-lg transition-colors ${
                filterRating === rating ? 'bg-yellow-50' : 'hover:bg-gray-100'
              }`}
            >
              <span className="text-sm font-medium w-12 text-right">{rating} ★</span>
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percentage}%`, backgroundColor: primaryColor }}
                />
              </div>
              <span className="text-sm text-gray-500 w-16 text-left">{count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
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
              Enviar opinión
            </Button>
          </div>
        </form>
      )}

      {submitted && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ¡Gracias por tu opinión! Será publicada después de ser revisada.
        </div>
      )}

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Filtrar:</span>
        </div>
        <button
          onClick={() => { setFilterRating(null); setPage(1) }}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            filterRating === null ? 'border-transparent text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
          style={filterRating === null ? { backgroundColor: primaryColor } : {}}
        >
          Todas ({totalReviews.toLocaleString()})
        </button>
        {[5, 4, 3, 2, 1].map(r => (
          <button
            key={r}
            onClick={() => { setFilterRating(filterRating === r ? null : r); setPage(1) }}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filterRating === r ? 'border-transparent text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
            style={filterRating === r ? { backgroundColor: primaryColor } : {}}
          >
            {r} ★
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="recent">Más recientes</option>
            <option value="helpful">Más útiles</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">
        Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length.toLocaleString()} opiniones
      </p>

      {/* Reviews list */}
      <div className="space-y-4">
        {paginatedReviews.map(review => (
          <div key={review.id} className="p-5 border rounded-xl hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {review.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{review.name}</span>
                    {review.verified && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                        ✓ Compra verificada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{review.city}</span>
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs text-gray-400">
                      {new Date(review.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
              {renderStars(review.rating)}
            </div>
            <p className="mt-3 text-gray-700 text-sm leading-relaxed">{review.comment}</p>
            <div className="mt-3 flex items-center gap-4">
              <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                <ThumbsUp className="h-3.5 w-3.5" />
                Útil ({review.likes})
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          
          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {(() => {
              const pages: (number | string)[] = []
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i)
              } else {
                pages.push(1)
                if (page > 3) pages.push('...')
                for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                  pages.push(i)
                }
                if (page < totalPages - 2) pages.push('...')
                pages.push(totalPages)
              }
              return pages.map((p, idx) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === p ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    style={page === p ? { backgroundColor: primaryColor } : {}}
                  >
                    {p}
                  </button>
                )
              )
            })()}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}
