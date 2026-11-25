'use client'

/**
 * «Escribir una opinión» de la ficha (Figma «16 Sitio web» 3123-88477: 2B formulario, 2C solo
 * compradores, 2D enviado y errores, 2F/2G/2H celular, 3B desde el correo).
 *
 * GUARDA de verdad por `POST /api/reviews` (estrellas, título, texto, fotos, nombre, ciudad,
 * correo). El servidor decide todo lo que importa: la organización (del host), si la compra está
 * verificada, si la tienda exige «Solo compradores», el límite de envíos y si sale publicada o
 * pendiente. Este formulario solo valida para ayudar y muestra lo que el servidor responde.
 *
 * - Solo compradores: antes del formulario, «Verificar compra» con la sesión de Mi cuenta o con el
 *   correo + número de pedido (`POST /api/reviews/verificar`). Si el servidor igual responde
 *   `solo_compradores`, vuelve a ese paso.
 * - Fotos: cada una se sube al elegirla (`POST /api/reviews/fotos`); hasta 3, 5 MB.
 * - Lo escrito nunca se borra ante un error.
 *
 * Se pinta como ventana (modal); en celular ocupa la pantalla.
 */

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { EnlaceSitio } from '@/components/site/EnlaceSitio'
import { EnlaceIniciarSesion } from '@/components/site/cuenta/EnlaceIniciarSesion'
import { EVENTO_ACCESO_ENTRO } from '@/components/site/cuenta/eventos'
import { AlertCircle, Camera, CheckCircle2, Clock, Info, Loader2, Package, Plus, ShieldCheck, Star, User, WifiOff, X } from 'lucide-react'

export const ETIQUETAS_ESTRELLAS = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'] as const
const MIN_LETRAS = 10
const MAX_LETRAS = 1000
const MAX_FOTOS = 3
const MAX_BYTES = 5 * 1024 * 1024

export interface VerificacionPrevia {
  orderId: string
  token: string | null
  orderNumber?: string | null
  entregadoEn?: string | null
  nombre?: string | null
}

interface ReviewFormProps {
  primaryColor: string
  /** Sin producto (usos antiguos) no hay a dónde guardar: se cierra sin enviar. */
  productId?: number
  productName?: string
  /** «Solo compradores» (la tienda o la sección). El servidor lo vuelve a exigir. */
  soloCompradores?: boolean
  fotosPermitidas?: boolean
  moderar?: boolean
  /** Desde el correo (3B) o tras verificar: la compra ya viene verificada. */
  verificacion?: VerificacionPrevia | null
  /** Estrellas elegidas en el correo. */
  ratingInicial?: number
  nombreInicial?: string
  origen?: 'ficha' | 'correo' | 'pedido' | 'cuenta'
  /** Ventana (por defecto) o incrustado en la página (formulario desde el correo). */
  incrustado?: boolean
  onCerrar?: () => void
  /** La opinión quedó publicada (sin moderación): quien lo usa puede recargar la lista. */
  onPublicada?: () => void
  /** Compatibilidad con el formulario anterior. */
  onSubmit?: (data: { name: string; comment: string; rating: number }) => void
}

type Paso = 'verificar' | 'formulario' | 'enviado'
type ErrorEnvio = { tipo: 'limite' | 'ya_opino' | 'red' | 'otro'; mensaje: string } | null
interface Foto { url: string | null; nombre: string; subiendo: boolean; error: string | null; local: string }

function Estrellas({ valor, onCambiar, color, invalida, idEtiqueta }: { valor: number; onCambiar: (n: number) => void; color: string; invalida: boolean; idEtiqueta: string }) {
  const [sobre, setSobre] = useState(0)
  const mostrado = sobre || valor
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-labelledby={idEtiqueta} aria-invalid={invalida || undefined} className="flex gap-1" onMouseLeave={() => setSobre(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={valor === i}
            aria-label={`${i} de 5: ${ETIQUETAS_ESTRELLAS[i]}`}
            onMouseEnter={() => setSobre(i)}
            onClick={() => onCambiar(i)}
            className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ '--tw-ring-color': color } as CSSProperties}
          >
            <Star className="h-8 w-8" style={i <= mostrado ? { color, fill: color } : { color: '#D1D5DB' }} aria-hidden="true" />
          </button>
        ))}
      </div>
      {mostrado > 0 && <span className="text-sm font-semibold" style={{ color }}>{ETIQUETAS_ESTRELLAS[mostrado]}</span>}
    </div>
  )
}

function ErrorCampo({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="mt-1 flex items-start gap-1 text-xs text-red-700">
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

export function ReviewForm({
  primaryColor,
  productId,
  productName,
  soloCompradores = false,
  fotosPermitidas = true,
  moderar = true,
  verificacion: verificacionInicial = null,
  ratingInicial = 0,
  nombreInicial = '',
  origen = 'ficha',
  incrustado = false,
  onCerrar,
  onPublicada,
  onSubmit,
}: ReviewFormProps) {
  const id = useId()
  const [verificacion, setVerificacion] = useState<VerificacionPrevia | null>(verificacionInicial)
  const [paso, setPaso] = useState<Paso>(soloCompradores && !verificacionInicial ? 'verificar' : 'formulario')
  const [rating, setRating] = useState(ratingInicial >= 1 && ratingInicial <= 5 ? ratingInicial : 0)
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [nombre, setNombre] = useState(nombreInicial || verificacionInicial?.nombre || '')
  const [ciudad, setCiudad] = useState('')
  const [correo, setCorreo] = useState('')
  const [acepto, setAcepto] = useState(false)
  const [trampa, setTrampa] = useState('')
  const [fotos, setFotos] = useState<Foto[]>([])
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorEnvio, setErrorEnvio] = useState<ErrorEnvio>(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ publicada: boolean } | null>(null)
  const entradaFotos = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Verificación
  const [verCorreo, setVerCorreo] = useState('')
  const [verNumero, setVerNumero] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [errorVerificar, setErrorVerificar] = useState<string | null>(null)
  const [conSesion, setConSesion] = useState(false)
  // Sube al entrar desde el acceso abierto encima («Entrar a Mi cuenta»): se vuelve a verificar.
  const [entradas, setEntradas] = useState(0)

  const cerrar = useCallback(() => onCerrar?.(), [onCerrar])

  // Escape cierra; el foco entra en la ventana.
  useEffect(() => {
    if (incrustado) return
    const anterior = document.activeElement as HTMLElement | null
    panel.current?.focus()
    // Con el acceso a la cuenta abierto encima, Escape cierra solo el acceso.
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.documentElement.hasAttribute('data-cuenta-abierta')) cerrar() }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      anterior?.focus?.()
    }
  }, [incrustado, cerrar])

  // Solo compradores: primero se prueba la sesión de Mi cuenta (sin pedir nada).
  useEffect(() => {
    if (paso !== 'verificar' || !productId) return
    let vivo = true
    fetch('/api/reviews/verificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) })
      .then((r) => r.json().catch(() => null))
      .then((j) => {
        if (!vivo || !j) return
        setConSesion(!!j.conSesion)
        if (j.verificado && j.orderId) {
          setVerificacion({ orderId: j.orderId, token: j.token ?? null, orderNumber: j.orderNumber, entregadoEn: j.entregadoEn, nombre: j.nombre })
          if (!nombre && j.nombre) setNombre(j.nombre)
          setPaso('formulario')
        }
      })
      .catch(() => undefined)
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir el paso (y al entrar)
  }, [paso, productId, entradas])

  useEffect(() => {
    const alEntrar = () => setEntradas((n) => n + 1)
    window.addEventListener(EVENTO_ACCESO_ENTRO, alEntrar)
    return () => window.removeEventListener(EVENTO_ACCESO_ENTRO, alEntrar)
  }, [])

  const verificarConPedido = async (e: FormEvent) => {
    e.preventDefault()
    setErrorVerificar(null)
    if (!verCorreo.trim() || !verNumero.trim()) {
      setErrorVerificar('Escribe el correo y el número de pedido.')
      return
    }
    setVerificando(true)
    try {
      const r = await fetch('/api/reviews/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, email: verCorreo.trim(), orderNumber: verNumero.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 429) setErrorVerificar('Demasiados intentos. Espera un momento.')
      else if (j.verificado && j.orderId) {
        setVerificacion({ orderId: j.orderId, token: j.token ?? null, orderNumber: j.orderNumber, entregadoEn: j.entregadoEn, nombre: j.nombre })
        if (!nombre && j.nombre) setNombre(j.nombre)
        if (!correo) setCorreo(verCorreo.trim())
        setPaso('formulario')
      } else setErrorVerificar('no_encontrado')
    } catch {
      setErrorVerificar('Revisa tu conexión e intenta de nuevo.')
    } finally {
      setVerificando(false)
    }
  }

  const elegirFotos = async (lista: FileList | null) => {
    if (!lista) return
    const libres = MAX_FOTOS - fotos.length
    const nuevas = Array.from(lista).slice(0, Math.max(0, libres))
    for (const archivo of nuevas) {
      const local = URL.createObjectURL(archivo)
      if (archivo.size > MAX_BYTES) {
        setFotos((f) => [...f, { url: null, nombre: archivo.name, subiendo: false, error: `La foto pesa ${(archivo.size / (1024 * 1024)).toFixed(0)} MB; el máximo es 5 MB`, local }])
        continue
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
        setFotos((f) => [...f, { url: null, nombre: archivo.name, subiendo: false, error: 'Solo JPG, PNG o WEBP', local }])
        continue
      }
      setFotos((f) => [...f, { url: null, nombre: archivo.name, subiendo: true, error: null, local }])
      const datos = new FormData()
      datos.append('foto', archivo)
      try {
        const r = await fetch('/api/reviews/fotos', { method: 'POST', body: datos })
        const j = await r.json().catch(() => ({}))
        setFotos((f) => f.map((x) => (x.local === local ? { ...x, subiendo: false, url: r.ok ? j.url ?? null : null, error: r.ok ? null : j.error || 'No pudimos subir la foto' } : x)))
      } catch {
        setFotos((f) => f.map((x) => (x.local === local ? { ...x, subiendo: false, error: 'Revisa tu conexión' } : x)))
      }
    }
    if (entradaFotos.current) entradaFotos.current.value = ''
  }

  const quitarFoto = (local: string) => {
    URL.revokeObjectURL(local)
    setFotos((f) => f.filter((x) => x.local !== local))
  }

  const validar = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (rating < 1) e.rating = 'Elige de 1 a 5 estrellas'
    const t = texto.trim()
    if (t.length < MIN_LETRAS) e.content = `Cuéntanos un poco más (mínimo ${MIN_LETRAS} letras)`
    if (!nombre.trim()) e.authorName = 'Escribe tu nombre'
    if (!verificacion) {
      if (!correo.trim()) e.email = 'Escribe tu correo'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim())) e.email = 'Revisa el correo'
    }
    if (!acepto) e.acepto = 'Acepta para poder publicar tu opinión'
    if (fotos.some((f) => f.error)) e.fotos = fotos.find((f) => f.error)?.error ?? 'Revisa las fotos'
    if (fotos.some((f) => f.subiendo)) e.fotos = 'Espera a que terminen de subir las fotos'
    return e
  }

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault()
    setErrorEnvio(null)
    const v = validar()
    setErrores(v)
    if (Object.keys(v).length > 0) return
    onSubmit?.({ name: nombre, comment: texto, rating })
    if (!productId) {
      cerrar()
      return
    }
    setEnviando(true)
    try {
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          rating,
          title: titulo.trim() || undefined,
          content: texto.trim(),
          authorName: nombre.trim(),
          authorCity: ciudad.trim() || undefined,
          email: correo.trim() || undefined,
          images: fotos.map((f) => f.url).filter(Boolean),
          orderId: verificacion?.orderId,
          token: verificacion?.token ?? undefined,
          origen,
          website: trampa,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        const publicada = j.status === 'approved'
        setResultado({ publicada })
        setPaso('enviado')
        return
      }
      if (j.codigo === 'campo_invalido' && typeof j.campo === 'string') {
        setErrores({ [j.campo === 'images' ? 'fotos' : j.campo]: j.error || 'Revisa este campo' })
      } else if (r.status === 429) setErrorEnvio({ tipo: 'limite', mensaje: 'Por seguridad, espera 1 hora para enviar otra.' })
      else if (j.codigo === 'ya_opino') setErrorEnvio({ tipo: 'ya_opino', mensaje: 'Puedes cambiar tu opinión desde Mi cuenta › Mis pedidos.' })
      else if (j.codigo === 'solo_compradores') {
        setVerificacion(null)
        setPaso('verificar')
      } else setErrorEnvio({ tipo: 'otro', mensaje: j.error || 'No pudimos enviar tu opinión. Inténtalo más tarde.' })
    } catch {
      setErrorEnvio({ tipo: 'red', mensaje: 'Revisa tu conexión. No perdiste lo que escribiste.' })
    } finally {
      setEnviando(false)
    }
  }

  const anillo = { '--tw-ring-color': primaryColor } as CSSProperties
  const claseCampo = (invalido: boolean) =>
    `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:bg-gray-900 dark:text-white ${invalido ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`
  const botonPrimario = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60'
  const botonSecundario = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
  const req = <span className="text-red-600" aria-hidden="true"> *</span>
  const opcional = <span className="font-normal text-gray-400"> (opcional)</span>

  const cabeceraProducto = productName ? (
    <div className="mb-5 flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 dark:bg-gray-900" aria-hidden="true">
        <Package className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{productName}</span>
    </div>
  ) : null

  let cuerpo: React.ReactNode
  if (paso === 'enviado' && resultado) {
    cuerpo = (
      <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-700"><CheckCircle2 className="h-7 w-7" aria-hidden="true" /></span>
        <p className="text-xl font-bold text-gray-900 dark:text-white">
          {resultado.publicada ? '¡Gracias! Tu opinión ya está publicada' : 'Gracias, la revisamos y la publicamos pronto'}
        </p>
        <p className="text-sm text-gray-500">
          {resultado.publicada ? 'Aparece de primera en «Más recientes».' : 'La tienda revisa cada opinión antes de publicarla.'}
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
          <span className="inline-flex gap-0.5" aria-label={`${rating} de 5`}>
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-3.5 w-3.5" style={i <= rating ? { color: primaryColor, fill: primaryColor } : { color: '#D1D5DB' }} aria-hidden="true" />)}
          </span>
          <span>{[titulo.trim() ? `«${titulo.trim()}»` : null, productName].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {resultado.publicada && (
            <button type="button" className={botonSecundario} onClick={() => { onPublicada?.(); cerrar() }}>Ver mi opinión</button>
          )}
          {incrustado ? (
            <EnlaceSitio href="/productos" className={botonPrimario} style={{ backgroundColor: primaryColor }}>Seguir comprando</EnlaceSitio>
          ) : (
            <button type="button" className={botonPrimario} style={{ backgroundColor: primaryColor }} onClick={() => { if (resultado.publicada) onPublicada?.(); cerrar() }}>Seguir comprando</button>
          )}
        </div>
      </div>
    )
  } else if (paso === 'verificar') {
    cuerpo = (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
          En esta tienda solo opinan quienes compraron el producto. Así tu opinión sale con «Compra verificada».
        </p>
        {!conSesion && (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">¿Compraste con tu cuenta?</p>
            <p className="mt-1 text-xs text-gray-500">Entra y verás tus compras entregadas para opinar.</p>
            {/* La regla de la cabecera (reglaAcceso.ts): el acceso se abre encima de esta ventana y,
                al entrar, se vuelve a verificar la compra aquí; en «Página», vuelve a esta ficha. */}
            <EnlaceIniciarSesion className={`${botonSecundario} mt-3 h-10`}>
              <User className="h-4 w-4" aria-hidden="true" /> Entrar a Mi cuenta
            </EnlaceIniciarSesion>
          </div>
        )}
        {conSesion && (
          <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            No encontramos este producto en tus pedidos entregados. Si lo compraste sin cuenta, confírmalo con el pedido.
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400" aria-hidden="true"><span className="h-px flex-1 bg-gray-200" />o<span className="h-px flex-1 bg-gray-200" /></div>
        <form onSubmit={verificarConPedido} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700" noValidate>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Confirma con tu pedido</p>
          <label htmlFor={`${id}-vc`} className="mt-3 block text-sm font-medium text-gray-800 dark:text-gray-100">Correo de la compra{req}</label>
          <input id={`${id}-vc`} type="email" autoComplete="email" value={verCorreo} onChange={(e) => setVerCorreo(e.target.value)} className={`${claseCampo(false)} mt-1`} style={anillo} />
          <label htmlFor={`${id}-vn`} className="mt-3 block text-sm font-medium text-gray-800 dark:text-gray-100">Número de pedido{req}</label>
          <input id={`${id}-vn`} value={verNumero} onChange={(e) => setVerNumero(e.target.value)} className={`${claseCampo(errorVerificar === 'no_encontrado')} mt-1`} style={anillo} aria-describedby={`${id}-vn-ayuda`} />
          <p id={`${id}-vn-ayuda`} className="mt-1 text-xs text-gray-500">Está en el correo de confirmación de tu compra.</p>
          {errorVerificar === 'no_encontrado' ? (
            <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="block text-sm">No encontramos un pedido entregado con ese correo y ese número</strong>
                Revisa los datos. Si tu pedido aún no se entrega, podrás opinar cuando llegue.
              </span>
            </div>
          ) : errorVerificar ? (
            <p className="mt-2 text-xs text-red-700" role="alert">{errorVerificar}</p>
          ) : null}
          <button type="submit" disabled={verificando} className={`${botonPrimario} mt-4 w-full`} style={{ backgroundColor: primaryColor }}>
            {verificando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Verificar compra
          </button>
        </form>
        <p className="text-xs text-gray-500">No usamos tu correo para publicidad: solo para confirmar la compra.</p>
      </div>
    )
  } else {
    cuerpo = (
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {verificacion && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="block">Compra verificada</strong>
              {verificacion.orderNumber ? <span className="text-xs">Pedido {verificacion.orderNumber}</span> : null}
            </span>
          </div>
        )}
        <div>
          <p id={`${id}-cal`} className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-100">Tu calificación{req}</p>
          <Estrellas valor={rating} onCambiar={(n) => { setRating(n); setErrores((x) => ({ ...x, rating: '' })) }} color={primaryColor} invalida={!!errores.rating} idEtiqueta={`${id}-cal`} />
          {ratingInicial > 0 && origen === 'correo' && <p className="mt-1 text-xs text-gray-500">La elegiste en el correo; puedes cambiarla.</p>}
          {errores.rating && <ErrorCampo id={`${id}-e-cal`}>{errores.rating}</ErrorCampo>}
        </div>
        <div>
          <label htmlFor={`${id}-tit`} className="text-sm font-medium text-gray-800 dark:text-gray-100">Título{opcional}</label>
          <input id={`${id}-tit`} value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Muy buena calidad" className={`${claseCampo(false)} mt-1`} style={anillo} />
        </div>
        <div>
          <label htmlFor={`${id}-txt`} className="text-sm font-medium text-gray-800 dark:text-gray-100">Tu opinión{req}</label>
          <textarea
            id={`${id}-txt`}
            value={texto}
            maxLength={MAX_LETRAS}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Qué te gustó? ¿Cómo lo usas? ¿Lo recomendarías?"
            className={`${claseCampo(!!errores.content)} mt-1 min-h-[110px]`}
            style={anillo}
            aria-invalid={!!errores.content || undefined}
            aria-describedby={`${id}-txt-ayuda`}
          />
          <p id={`${id}-txt-ayuda`} className="mt-1 text-xs text-gray-500">Mínimo {MIN_LETRAS} letras · {texto.length.toLocaleString('es-CO')} / {MAX_LETRAS.toLocaleString('es-CO')}</p>
          {errores.content && <ErrorCampo id={`${id}-e-txt`}>{errores.content}</ErrorCampo>}
        </div>
        {fotosPermitidas && (
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Fotos{opcional}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {fotos.map((f) => (
                <span key={f.local} className={`relative block h-20 w-20 overflow-hidden rounded-lg border ${f.error ? 'border-red-500' : 'border-gray-200'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local del archivo elegido */}
                  <img src={f.local} alt={f.nombre} className="h-full w-full object-cover" />
                  {f.subiendo && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin text-gray-600" aria-label="Subiendo" /></span>}
                  <button type="button" onClick={() => quitarFoto(f.local)} aria-label={`Quitar ${f.nombre}`} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/70 text-white">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {fotos.length < MAX_FOTOS && (
                <button type="button" onClick={() => entradaFotos.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">
                  {fotos.length === 0 ? <Camera className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
                  Agregar
                </button>
              )}
              <input ref={entradaFotos} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void elegirFotos(e.target.files)} />
            </div>
            <p className="mt-1 text-xs text-gray-500">Hasta {MAX_FOTOS} fotos · JPG o PNG · máximo 5 MB cada una</p>
            {errores.fotos && <ErrorCampo id={`${id}-e-fot`}>{errores.fotos}</ErrorCampo>}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-nom`} className="text-sm font-medium text-gray-800 dark:text-gray-100">{origen === 'correo' ? 'Nombre que se publica' : 'Nombre'}{req}</label>
            <input id={`${id}-nom`} value={nombre} maxLength={80} autoComplete="name" onChange={(e) => setNombre(e.target.value)} className={`${claseCampo(!!errores.authorName)} mt-1`} style={anillo} />
            <p className="mt-1 text-xs text-gray-500">Así aparece en la opinión</p>
            {errores.authorName && <ErrorCampo id={`${id}-e-nom`}>{errores.authorName}</ErrorCampo>}
          </div>
          <div>
            <label htmlFor={`${id}-ciu`} className="text-sm font-medium text-gray-800 dark:text-gray-100">Ciudad{opcional}</label>
            <input id={`${id}-ciu`} value={ciudad} maxLength={80} autoComplete="address-level2" onChange={(e) => setCiudad(e.target.value)} className={`${claseCampo(false)} mt-1`} style={anillo} />
          </div>
        </div>
        {!verificacion && (
          <div>
            <label htmlFor={`${id}-cor`} className="text-sm font-medium text-gray-800 dark:text-gray-100">Correo{req}</label>
            <input id={`${id}-cor`} type="email" value={correo} autoComplete="email" onChange={(e) => setCorreo(e.target.value)} className={`${claseCampo(!!errores.email)} mt-1`} style={anillo} />
            <p className="mt-1 text-xs text-gray-500">No se publica.</p>
            {errores.email && <ErrorCampo id={`${id}-e-cor`}>{errores.email}</ErrorCampo>}
          </div>
        )}
        {/* Campo trampa: invisible para las personas. */}
        <input type="text" name="website" value={trampa} onChange={(e) => setTrampa(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <div>
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded" style={{ accentColor: primaryColor }} />
            Acepto que la tienda publique mi opinión y use mis datos según su política de privacidad.
          </label>
          {errores.acepto && <ErrorCampo id={`${id}-e-ace`}>{errores.acepto}</ErrorCampo>}
        </div>
        {errorEnvio && (
          <div
            role="alert"
            className={`flex gap-2 rounded-lg border p-3 text-xs ${errorEnvio.tipo === 'limite' ? 'border-amber-200 bg-amber-50 text-amber-900' : errorEnvio.tipo === 'ya_opino' ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-red-200 bg-red-50 text-red-800'}`}
          >
            {errorEnvio.tipo === 'limite' ? <Clock className="h-4 w-4 shrink-0" aria-hidden="true" /> : errorEnvio.tipo === 'ya_opino' ? <Info className="h-4 w-4 shrink-0" aria-hidden="true" /> : errorEnvio.tipo === 'red' ? <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>
              <strong className="block text-sm">
                {errorEnvio.tipo === 'limite' ? 'Ya enviaste varias opiniones' : errorEnvio.tipo === 'ya_opino' ? 'Ya opinaste sobre este producto' : 'No pudimos enviar tu opinión'}
              </strong>
              {errorEnvio.mensaje}
              {errorEnvio.tipo === 'red' && (
                <button type="button" onClick={() => void enviar()} className="ml-1 font-semibold underline">Reintentar</button>
              )}
            </span>
          </div>
        )}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <p className="text-xs text-gray-500">{moderar ? 'Revisamos cada opinión antes de publicarla.' : 'Tu opinión se publica apenas la envíes.'}</p>
          <div className="flex gap-2">
            {!incrustado && <button type="button" onClick={cerrar} className={botonSecundario}>Cancelar</button>}
            <button type="submit" disabled={enviando} className={`${botonPrimario} flex-1 sm:flex-none`} style={{ backgroundColor: primaryColor }}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Enviar opinión
            </button>
          </div>
        </div>
      </form>
    )
  }

  const titulo_ = paso === 'enviado' ? 'Opinión enviada' : origen === 'correo' ? '¿Qué te pareció?' : 'Escribir una opinión'

  if (incrustado) {
    return (
      <section aria-labelledby={`${id}-titulo`} className="flex flex-col">
        <h2 id={`${id}-titulo`} className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">{titulo_}</h2>
        {cabeceraProducto}
        {cuerpo}
      </section>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-gray-900/50 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar() }}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        tabIndex={-1}
        className="relative flex max-h-full w-full flex-col overflow-y-auto bg-white p-5 shadow-xl focus:outline-none sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:p-7 dark:bg-gray-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={`${id}-titulo`} className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">{titulo_}</h2>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {paso !== 'enviado' && cabeceraProducto}
        {cuerpo}
      </div>
    </div>
  )
}
