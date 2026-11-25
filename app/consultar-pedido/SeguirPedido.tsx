'use client'

/**
 * «Consultar pedido» (Figma «16 Sitio web» › Consultar pedido v2, 3102:84056, aprobado por el dueño
 * el 2026-11-24). Es el «Sigue tu pedido» de /rastrear (2975:72068) —mismo formulario, pestañas,
 * tipografía y tono, que al dueño le encantan— con lo que le faltaba del Figma:
 * - Primer ingreso: «Aquí verás tu pedido» a la derecha (abajo en el celular).
 * - Buscando: campos bloqueados y la silueta del pedido.
 * - Errores por campo (falta un dato, formato) y generales: no existe o no coincide (el MISMO
 *   mensaje), muchas búsquedas y sin conexión con «Reintentar».
 * - Resultado EN LA MISMA PÁGINA: `OrderTracker` incrustado, el de /pedido/<n> (estado, pasos,
 *   pago, envío, productos, totales, ayuda), con el token de seguimiento que devuelve
 *   /api/cuenta/buscar-pedido. El token no se pone en la URL.
 * La organización y la comparación del correo o teléfono las decide el servidor.
 *
 * «Número de guía» (Figma 3240:97997, aprobado 2026-11-25; antes «Guía de transportadora»): el
 * número impreso en la guía (DEL-…), la guía de la transportadora o el TRK viejo, por `?guia=`. La
 * página busca en el servidor con la organización del host y el límite de intentos, y entrega aquí
 * `consultaGuia`, ya recortada (`vistaGuiaPublica`): el resultado (G2/G3/M2/M3) ocupa la página,
 * «no encontrada» (M4) es UN solo aviso para «no existe» y «es de otra tienda», y si escriben un
 * número de pedido (WO-… sin DEL-) se sugiere la otra pestaña con el número ya escrito.
 */
import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle, Barcode, Clock, CreditCard, HelpCircle, Info, Loader2, Lock, Mail, MapPin, MessageSquare, Package,
  ScanBarcode, Search, ShoppingBag, Truck, User, WifiOff,
} from 'lucide-react'
import { EnlaceIniciarSesion } from '@/components/site/cuenta/EnlaceIniciarSesion'
import { useAvatarCuenta } from '@/components/site/cuenta/avatar/datosAvatar'
import Link from '@/components/site/Enlace'
import { SiluetaPedido } from '@/components/site/rastreo/SiluetaPedido'
import { ResultadoGuia } from '@/components/site/rastreo/ResultadoGuia'
import { OrderTracker } from '@/app/pedido/[id]/OrderTracker'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { normalizarNumeroPedido, tipoContacto } from '@/lib/cuenta/reglasCuenta'
import { pareceNumeroPedido, type ConsultaGuia } from '@/lib/orders/consultaGuia'

const CAMPO =
  'h-12 w-full rounded-[10px] border border-slate-300 bg-white pl-10 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)] disabled:bg-slate-50 disabled:text-slate-500'
const CAMPO_ERROR = '!border-red-400'

/** Error general de la búsqueda. `no_encontrado` es el mismo para «no existe» y «no coincide». */
type ErrorBusqueda =
  | { tipo: 'no_encontrado' }
  | { tipo: 'muchas' }
  | { tipo: 'conexion' }
  | { tipo: 'otro'; texto: string }

interface ErroresCampo {
  numero?: string
  contacto?: string
}

/** Lo que falta o sobra en cada campo, antes de ir al servidor. */
function validar(numero: string, contacto: string): ErroresCampo {
  const e: ErroresCampo = {}
  if (!numero.trim()) e.numero = 'Escribe el número del pedido.'
  else if (!normalizarNumeroPedido(numero)) e.numero = 'Escribe el número completo, tal como aparece en tu correo de confirmación.'
  if (!contacto.trim()) e.contacto = 'Escribe el correo o el teléfono con el que compraste.'
  else if (!tipoContacto(contacto)) e.contacto = 'Escribe un correo (con @) o un número de celular.'
  return e
}

const QUE_VERAS: { icono: typeof Truck; titulo: string; detalle: string }[] = [
  { icono: Truck, titulo: 'En qué va', detalle: 'Recibido, alistando, enviado o entregado.' },
  { icono: CreditCard, titulo: 'El pago', detalle: 'Si falta pagar, págalo aquí mismo; si es contraentrega, cuánto pagas al recibir.' },
  { icono: MapPin, titulo: 'La entrega', detalle: 'Dirección, transportadora y número de guía.' },
  { icono: ShoppingBag, titulo: 'Tus productos', detalle: 'Con foto, cantidades y el total.' },
]

/** Lo mismo para el número de guía (G1/M1): lo que pinta `ResultadoGuia`. */
const QUE_VERAS_GUIA: { icono: typeof Truck; titulo: string; detalle: string }[] = [
  { icono: Truck, titulo: 'En qué va', detalle: 'Recibido, preparando, en camino o entregado, con la hora de cada paso.' },
  { icono: User, titulo: 'Quién lo lleva', detalle: 'El nombre del domiciliario de la tienda, o la transportadora con su guía y su enlace.' },
  { icono: Clock, titulo: 'Cuándo llega', detalle: 'La hora o el día estimado de entrega.' },
]

/** Ejemplo del número impreso en la guía (G1/M1). */
const EJEMPLO_GUIA = 'DEL-WO-452-MX4K2P7F-A3QZ'

/**
 * «Aquí verás tu pedido» (D1 3104:84146 / M1 3105:84304): solo informa, no tiene acciones. Con la
 * pestaña de la guía, «Aquí verás tu envío» en el mismo lugar: las dos pestañas usan la misma
 * cuadrícula, así el formulario y las pestañas no saltan de sitio al cambiar (en el computador,
 * después del salto quedaba bajo el puntero la otra pestaña y parecía que el resaltado no cambiaba).
 */
function PanelPrimerIngreso({ modo = 'pedido' }: { modo?: 'pedido' | 'guia' }) {
  const guia = modo === 'guia'
  return (
    <section
      aria-labelledby="consultar-aqui-veras"
      className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5 lg:items-center lg:px-10 lg:py-12"
      data-panel-consulta={guia ? 'primer-ingreso-guia' : 'primer-ingreso'}
    >
      <div aria-hidden="true" className="relative hidden h-16 w-16 lg:block">
        {guia
          ? <Truck className="h-14 w-14" style={{ color: 'var(--primary-color)' }} strokeWidth={1.5} />
          : <Package className="h-14 w-14" style={{ color: 'var(--primary-color)' }} strokeWidth={1.5} />}
        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white">
          <Search className="h-4 w-4" />
        </span>
      </div>
      <h2 id="consultar-aqui-veras" className="text-lg font-semibold text-slate-900">{guia ? 'Aquí verás tu envío' : 'Aquí verás tu pedido'}</h2>
      <p className="hidden text-center text-[15px] text-slate-600 lg:block">
        {guia
          ? 'Escribe el número de la guía. Te mostramos:'
          : 'Escribe el número y el correo o teléfono de tu compra. En segundos te mostramos:'}
      </p>
      <ul className="flex w-full flex-col gap-3">
        {(guia ? QUE_VERAS_GUIA : QUE_VERAS).map(({ icono: Icono, titulo, detalle }) => (
          <li key={titulo} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 10%, white)', color: 'var(--primary-color)' }}
            >
              <Icono className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{titulo}</span>
              <span className="block text-[13px] text-slate-600">{detalle}</span>
            </span>
          </li>
        ))}
      </ul>
      {guia && (
        <div className="flex w-full gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4" data-aviso-direccion="">
          <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-slate-900">Tu dirección no se muestra aquí</p>
            <p className="text-[13px] text-slate-600">
              La guía va pegada por fuera de la caja y cualquiera puede leerla. Por eso, solo con la guía no mostramos tu dirección, tu nombre ni tu teléfono. Para verlos abre el enlace del correo de confirmación o inicia sesión.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export function SeguirPedido({
  modoInicial,
  guiaInicial,
  numeroInicial = '',
  consultaGuia = null,
  whatsapp,
  whatsappGuia = null,
  telefonoTienda = null,
  primaryColor,
  rutaSeguirPidiendo,
}: {
  modoInicial: 'pedido' | 'guia'
  guiaInicial: string
  /** `?numero=`: el número de pedido ya escrito. */
  numeroInicial?: string
  /** Lo que encontró la página con `?guia=` (ya sin datos personales), o null si no se buscó. */
  consultaGuia?: ConsultaGuia | null
  whatsapp: string | null
  /** WhatsApp con la guía ya escrita, para «¿Dudas con tu envío?». */
  whatsappGuia?: string | null
  telefonoTienda?: string | null
  primaryColor: string
  /** «Seguir comprando/pidiendo» del resultado (la carta o el catálogo). */
  rutaSeguirPidiendo: string
}) {
  const [modo, setModo] = useState<'pedido' | 'guia'>(modoInicial)
  const { sesion } = useAvatarCuenta()
  const { ruta } = useRutaSitio()
  const [numero, setNumero] = useState(numeroInicial)
  const [contacto, setContacto] = useState('')
  const [guia, setGuia] = useState(guiaInicial)
  const [enviando, setEnviando] = useState(false)
  const [errores, setErrores] = useState<ErroresCampo>({})
  const [error, setError] = useState<ErrorBusqueda | null>(null)
  const [ayudaNumero, setAyudaNumero] = useState(false)
  const [resultado, setResultado] = useState<{ numero: string; token: string | null } | null>(null)
  const [anuncio, setAnuncio] = useState('')
  // Número de guía: el resultado de la página y el aviso bajo el campo (se borra al escribir).
  const [verResultadoGuia, setVerResultadoGuia] = useState(consultaGuia?.tipo === 'encontrada')
  const [avisoGuia, setAvisoGuia] = useState<ConsultaGuia | null>(consultaGuia && consultaGuia.tipo !== 'encontrada' ? consultaGuia : null)
  const refGuia = useRef<HTMLInputElement>(null)
  const refFormGuia = useRef<HTMLFormElement>(null)
  const buscarGuiaIgual = useRef(false)
  const refNumero = useRef<HTMLInputElement>(null)
  const refContacto = useRef<HTMLInputElement>(null)
  const refResultado = useRef<HTMLDivElement>(null)

  // Al hallar el pedido, el foco pasa al resultado (y se anuncia); al volver, al número.
  useEffect(() => {
    if (resultado) refResultado.current?.focus()
  }, [resultado])

  const buscar = async () => {
    setError(null)
    const e = validar(numero, contacto)
    setErrores(e)
    if (e.numero || e.contacto) {
      ;(e.numero ? refNumero : refContacto).current?.focus()
      return
    }
    setEnviando(true)
    setAnuncio('')
    try {
      const res = await fetch('/api/cuenta/buscar-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, contacto }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.pedido && typeof data.pedido.numero === 'string') {
        const token = typeof data.pedido.token === 'string' ? data.pedido.token : null
        setResultado({ numero: data.pedido.numero, token })
        setAnuncio(`Encontramos tu pedido ${data.pedido.numero}.`)
        return
      } else if (res.ok && typeof data.ruta === 'string' && data.ruta.startsWith('/pedido/')) {
        // Respuesta sin `pedido` (servidor anterior): la página del pedido, como antes.
        window.location.href = data.ruta
        return
      }
      if (res.status === 404) setError({ tipo: 'no_encontrado' })
      else if (res.status === 429) setError({ tipo: 'muchas' })
      else setError({ tipo: 'otro', texto: typeof data.error === 'string' ? data.error : 'No pudimos buscar tu pedido. Intenta de nuevo.' })
      setAnuncio('')
    } catch {
      setError({ tipo: 'conexion' })
      setAnuncio('')
    } finally {
      setEnviando(false)
    }
  }

  const buscarOtro = () => {
    setResultado(null)
    setAnuncio('')
    setError(null)
    // Tras volver a pintar el formulario.
    requestAnimationFrame(() => refNumero.current?.focus())
  }

  const enlaceWhatsapp = whatsapp ? (
    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
      <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
      Escríbenos por WhatsApp
    </a>
  ) : null

  const avisoError = error ? (
    error.tipo === 'no_encontrado' ? (
      <div role="alert" className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700" data-error-consulta="no_encontrado">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">No encontramos un pedido con esos datos</p>
          <p>Revisa el número completo y el correo o teléfono con el que compraste.</p>
          {enlaceWhatsapp}
        </div>
      </div>
    ) : error.tipo === 'muchas' ? (
      <div role="alert" className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800" data-error-consulta="muchas">
        <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Hiciste muchas búsquedas</p>
          <p>Por seguridad, espera 10 minutos y vuelve a intentar.</p>
        </div>
      </div>
    ) : error.tipo === 'conexion' ? (
      <div role="alert" className="flex gap-2.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-[13px] text-slate-700" data-error-consulta="conexion">
        <WifiOff aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="flex flex-col items-start gap-1">
          <p className="font-semibold text-slate-900">No pudimos buscar tu pedido</p>
          <p>Revisa tu conexión a internet.</p>
          <button type="button" onClick={() => void buscar()} className="font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
            Reintentar
          </button>
        </div>
      </div>
    ) : (
      <div role="alert" className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700" data-error-consulta="otro">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="flex flex-col items-start gap-1">
          <p>{error.texto}</p>
          <button type="button" onClick={() => void buscar()} className="font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
            Reintentar
          </button>
        </div>
      </div>
    )
  ) : null

  const errorCampo = (id: string, texto?: string) =>
    texto ? (
      <p id={id} className="flex items-start gap-1.5 text-xs text-red-700">
        <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-shrink-0" />
        {texto}
      </p>
    ) : null

  // Región que anuncia «Encontramos tu pedido…» (el «Buscando…» lo anuncia la silueta): existe
  // siempre, para que el lector de pantalla la escuche cuando cambia.
  const region = <p className="sr-only" aria-live="polite">{anuncio}</p>

  /** De la guía a «Número de pedido», con el número ya escrito si se conoce (decisión E del Figma). */
  const pasarANumeroPedido = (valor: string | null) => {
    setVerResultadoGuia(false)
    setAvisoGuia(null)
    setModo('pedido')
    setError(null)
    setErrores({})
    if (valor) setNumero(valor)
    requestAnimationFrame(() => (valor ? refContacto : refNumero).current?.focus())
  }

  if (verResultadoGuia && consultaGuia?.tipo === 'encontrada') {
    return (
      <div className="mx-auto w-full max-w-xl lg:max-w-5xl" data-seguir-pedido="" data-consulta="resultado-guia">
        <ResultadoGuia
          vista={consultaGuia.vista}
          whatsapp={whatsappGuia}
          telefonoTienda={telefonoTienda}
          onBuscarOtra={() => {
            setVerResultadoGuia(false)
            setModo('guia')
            setGuia('')
            requestAnimationFrame(() => refGuia.current?.focus())
          }}
          onVerPedido={pasarANumeroPedido}
        />
      </div>
    )
  }

  if (resultado) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 text-slate-900 lg:max-w-5xl" data-seguir-pedido="" data-consulta="resultado">
        {region}
        <div className="flex justify-end">
          <button type="button" onClick={buscarOtro} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
            <Search aria-hidden="true" className="h-4 w-4" />
            Buscar otro pedido
          </button>
        </div>
        <div ref={refResultado} tabIndex={-1} aria-label={`Pedido ${resultado.numero}`} className="outline-none" data-resultado-consulta="">
          <OrderTracker
            incrustado
            direccionCompleta
            dosColumnas
            orderIdentifier={resultado.numero}
            token={resultado.token}
            primaryColor={primaryColor}
            rutaSeguirPidiendo={rutaSeguirPidiendo}
          />
        </div>
      </div>
    )
  }

  const formulario = (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold leading-snug">Consultar pedido</h1>
      <p className="text-[15px] leading-snug text-slate-600">No necesitas cuenta. Usa los datos de tu correo de confirmación.</p>

      <div role="tablist" aria-label="Cómo buscar" className="flex rounded-[10px] bg-slate-100 p-1">
        {(
          [
            ['pedido', 'Número de pedido'],
            ['guia', 'Número de guía'],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={modo === clave}
            onClick={() => {
              setModo(clave)
              setError(null)
              setErrores({})
              setAvisoGuia(null)
            }}
            data-pestana-consulta={clave}
            className={`flex-1 rounded-lg py-2 text-[13px] ${modo === clave ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'font-medium text-slate-600 hover:text-slate-900'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {modo === 'pedido' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void buscar()
          }}
          className="flex flex-col gap-4"
          noValidate
          aria-busy={enviando}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rastrear-numero" className="text-[13px] font-medium">Número de pedido</label>
            <div className="relative">
              <Package aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={refNumero}
                id="rastrear-numero"
                className={`${CAMPO} uppercase ${errores.numero ? CAMPO_ERROR : ''}`}
                autoComplete="off"
                placeholder="WO-000412"
                value={numero}
                onChange={(e) => {
                  setNumero(e.target.value)
                  if (errores.numero) setErrores((x) => ({ ...x, numero: undefined }))
                }}
                disabled={enviando}
                aria-invalid={errores.numero ? true : undefined}
                aria-describedby={errores.numero ? 'rastrear-numero-error' : ayudaNumero ? 'rastrear-numero-ayuda' : undefined}
              />
            </div>
            {errorCampo('rastrear-numero-error', errores.numero)}
            <button
              type="button"
              onClick={() => setAyudaNumero((v) => !v)}
              aria-expanded={ayudaNumero}
              aria-controls="rastrear-numero-ayuda"
              className="inline-flex items-center gap-1.5 self-start text-xs font-medium hover:underline"
              style={{ color: 'var(--primary-color)' }}
            >
              <HelpCircle aria-hidden="true" className="h-3.5 w-3.5" />
              ¿Dónde encuentro mi número?
            </button>
            {ayudaNumero && (
              <p id="rastrear-numero-ayuda" className="text-xs text-slate-600">
                Está en el correo y en el WhatsApp de confirmación de tu compra («Recibimos tu pedido»). Si no ves el correo, revisa la carpeta de spam o promociones.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rastrear-contacto" className="text-[13px] font-medium">Correo o teléfono de la compra</label>
            <div className="relative">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={refContacto}
                id="rastrear-contacto"
                className={`${CAMPO} ${errores.contacto ? CAMPO_ERROR : ''}`}
                autoComplete="email"
                placeholder="tu@correo.com o 300 123 4567"
                value={contacto}
                onChange={(e) => {
                  setContacto(e.target.value)
                  if (errores.contacto) setErrores((x) => ({ ...x, contacto: undefined }))
                }}
                disabled={enviando}
                aria-invalid={errores.contacto ? true : undefined}
                aria-describedby={errores.contacto ? 'rastrear-contacto-error rastrear-contacto-ayuda' : 'rastrear-contacto-ayuda'}
              />
            </div>
            {errorCampo('rastrear-contacto-error', errores.contacto)}
            <p id="rastrear-contacto-ayuda" className="text-xs text-slate-600">Para que solo tú veas la dirección y los datos de la entrega.</p>
          </div>
          {avisoError}
          <button
            type="submit"
            disabled={enviando}
            className="flex h-12 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            {enviando ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
            {enviando ? 'Buscando tu pedido…' : 'Ver mi pedido'}
          </button>
        </form>
      ) : (
        <form
          ref={refFormGuia}
          method="GET"
          action="/consultar-pedido"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            // Un número de pedido (WO-… sin DEL-) se busca en la otra pestaña: se sugiere antes de
            // gastar una búsqueda. «Es una guía, buscarla igual» deja pasar el envío.
            const pedido = buscarGuiaIgual.current ? null : pareceNumeroPedido(guia)
            buscarGuiaIgual.current = false
            if (pedido) {
              e.preventDefault()
              setAvisoGuia({ tipo: 'parece_pedido', numero: pedido })
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rastrear-guia" className="text-[13px] font-medium">Número de guía</label>
            <div className="relative">
              <ScanBarcode aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={refGuia}
                id="rastrear-guia"
                name="guia"
                required
                autoComplete="off"
                className={`${CAMPO} uppercase ${avisoGuia?.tipo === 'no_encontrada' ? CAMPO_ERROR : ''}`}
                placeholder={`Ej.: ${EJEMPLO_GUIA}`}
                value={guia}
                onChange={(e) => {
                  setGuia(e.target.value)
                  if (avisoGuia) setAvisoGuia(null)
                }}
                aria-invalid={avisoGuia?.tipo === 'no_encontrada' ? true : undefined}
                aria-describedby="rastrear-guia-ayuda"
              />
            </div>
            <p id="rastrear-guia-ayuda" className="text-xs text-slate-600">
              Es el número que está debajo del código de barras en la guía pegada a tu paquete. También sirve la guía que te dio la transportadora.
            </p>
          </div>
          {!avisoGuia && (
            <div aria-hidden="true" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Barcode className="h-8 w-12 flex-shrink-0 text-slate-900" strokeWidth={1.5} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11px] text-slate-500">Así se ve en tu guía</span>
                <span className="self-start truncate rounded border px-1.5 py-0.5 text-xs font-bold text-slate-900" style={{ borderColor: 'var(--primary-color)' }}>{EJEMPLO_GUIA}</span>
              </div>
            </div>
          )}
          {avisoGuia?.tipo === 'no_encontrada' ? (
            <div role="alert" className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700" data-error-guia="no_encontrada">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-semibold">No encontramos esa guía</p>
                <p>Revisa el número completo: está debajo del código de barras y empieza por DEL- (ej.: {EJEMPLO_GUIA}), o es la guía que te dio la transportadora.</p>
                {enlaceWhatsapp}
              </div>
            </div>
          ) : avisoGuia?.tipo === 'muchas' ? (
            <div role="alert" className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800" data-error-guia="muchas">
              <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Hiciste muchas búsquedas</p>
                <p>Por seguridad, espera 10 minutos y vuelve a intentar.</p>
              </div>
            </div>
          ) : avisoGuia?.tipo === 'error' ? (
            <div role="alert" className="flex gap-2.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-[13px] text-slate-700" data-error-guia="error">
              <WifiOff aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-slate-900">No pudimos buscar tu guía</p>
                <p>Intenta de nuevo en unos segundos.</p>
              </div>
            </div>
          ) : avisoGuia?.tipo === 'parece_pedido' ? (
            <div role="alert" className="flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[13px] text-slate-700" data-error-guia="parece_pedido">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-700" />
              <div className="flex flex-col items-start gap-1.5">
                <p className="font-semibold text-blue-700">Eso parece un número de pedido</p>
                <p>Los pedidos se buscan con su número y el correo o teléfono de la compra.</p>
                <button
                  type="button"
                  onClick={() => pasarANumeroPedido(avisoGuia.numero)}
                  className="font-semibold hover:underline"
                  style={{ color: 'var(--primary-color)' }}
                >
                  Buscar como número de pedido →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    buscarGuiaIgual.current = true
                    refFormGuia.current?.requestSubmit()
                  }}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  Es una guía, buscarla igual
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="submit"
            className="flex h-12 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            Rastrear envío
          </button>
        </form>
      )}

      {/* Con sesión no se invita a «Ingresar»: se lleva a sus pedidos (la misma fuente de sesión que
          el avatar de la cabecera). Mientras no se sabe (null), no se pinta nada. */}
      {sesion === true ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-sm font-semibold">Ya iniciaste sesión</p>
          <p className="text-[13px] text-slate-600">Todos tus pedidos están en Mi cuenta, sin buscar el número.</p>
          <Link
            href={ruta('/mi-cuenta/pedidos')}
            className="self-center text-sm font-semibold hover:underline"
            style={{ color: 'var(--primary-color)' }}
          >
            Ver mis pedidos →
          </Link>
        </div>
      ) : sesion === false ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-sm font-semibold">¿Tienes cuenta?</p>
          <p className="text-[13px] text-slate-600">Inicia sesión para ver todos tus pedidos, sin buscar el número.</p>
          {/* La regla de la cabecera (reglaAcceso.ts): al entrar se queda aquí y aparece «Ver mis
              pedidos»; en «Página», /auth?siguiente=/consultar-pedido. */}
          <EnlaceIniciarSesion className="self-center text-sm font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
            Iniciar sesión →
          </EnlaceIniciarSesion>
        </div>
      ) : null}

      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm font-medium hover:underline" style={{ color: 'var(--primary-color)' }}>
          <MessageSquare aria-hidden="true" className="h-4 w-4" />
          ¿No lo encuentras? Escríbenos por WhatsApp
        </a>
      )}
    </div>
  )

  // La MISMA cuadrícula en las dos pestañas: el formulario y las pestañas se quedan quietos al
  // cambiar (antes la guía pasaba a una columna centrada, las pestañas saltaban bajo el puntero y
  // en el computador parecía que el resaltado no cambiaba). A la derecha (abajo en el celular):
  // - Número: «Aquí verás tu pedido» o, mientras se busca, la silueta.
  // - Guía: «Aquí verás tu envío» (el resultado de la guía ocupa la página entera, arriba).
  const panel = modo === 'guia'
    ? <PanelPrimerIngreso modo="guia" />
    : enviando ? <SiluetaPedido /> : <PanelPrimerIngreso />
  return (
    <div className="mx-auto grid w-full max-w-xl gap-6 text-slate-900 lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-8" data-seguir-pedido="" data-modo-consulta={modo}>
      {region}
      {formulario}
      <div className="lg:pt-[5.25rem]">{panel}</div>
    </div>
  )
}
