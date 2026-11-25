'use client'

/**
 * Ingresar con un código de 6 dígitos al correo (Figma «16 Sitio web» 2975:71911 y 2975:72023,
 * aprobados el 2026-11-24). Lo usan las 4 formas de abrir la cuenta: la página /auth (AuthForm) y
 * el panel, la ventana, el diálogo y la hoja del celular (FormularioAcceso). La lógica es la de
 * useAcceso (pedirCodigo / entrarConCodigo): aquí solo se pinta.
 *
 * - Paso 1: correo → «Recibir código»; «Continuar con Google» (solo si la tienda lo activó),
 *   «Ingresar con contraseña» y «¿Compraste sin cuenta? Busca tu pedido».
 * - Paso 2: los 6 dígitos (se pegan de una vez y entra solo al completar), reenvío con cuenta
 *   regresiva, aviso de los pedidos hechos sin cuenta y «Recordarme en este celular».
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronLeft, Eye, EyeOff, Globe, KeyRound, Loader2, Lock, Mail, Package } from 'lucide-react'
import {
  LARGO_CODIGO,
  MINUTOS_VIGENCIA_CODIGO,
  segundosParaReenviar,
  textoCuentaRegresiva,
} from '@/lib/cuenta/reglasCuenta'

const CLASE_CAMPO =
  'h-12 w-full rounded-[10px] border border-slate-300 bg-white pl-10 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-2 focus:border-[var(--primary-color)] disabled:bg-slate-50'

function AvisoError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-snug text-red-700">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function BotonPrincipal({ children, enviando, textoEnviando, icono }: { children: ReactNode; enviando: boolean; textoEnviando: string; icono?: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={enviando}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
      style={{ backgroundColor: 'var(--primary-color)' }}
    >
      {enviando ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : icono}
      {enviando ? textoEnviando : children}
    </button>
  )
}

const CLASE_SECUNDARIO =
  'flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white text-[15px] font-semibold text-slate-900 transition-colors hover:bg-slate-50'

export interface PasoCorreoProps {
  correo: string
  onCorreo: (v: string) => void
  enviando: boolean
  error: string
  onEnviar: () => void
  /** Tienda con «Continuar con Google» activo (`header_cuenta.google`). */
  google?: boolean
  /** Ruta interna a la que vuelve después de Google. */
  siguiente?: string
  onContrasena: () => void
  /** Ventana compacta: sin texto de introducción ni recuadro de pedido sin cuenta. */
  compacto?: boolean
  /** Diálogo: arriba van sus pestañas, sin texto de introducción. */
  sinIntro?: boolean
}

/** Paso 1 (A, 2975:71945): correo y «Recibir código». */
export function PasoCorreo({ correo, onCorreo, enviando, error, onEnviar, google = false, siguiente, onContrasena, compacto = false, sinIntro = false }: PasoCorreoProps) {
  return (
    <div className="flex flex-col gap-3.5" data-vista-acceso="codigo-correo">
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          onEnviar()
        }}
      >
        {!compacto && !sinIntro && (
          <p className="text-sm leading-snug text-slate-600">Te enviamos un código a tu correo. Si es la primera vez, creamos tu cuenta con él: no necesitas contraseña.</p>
        )}
        {error && <AvisoError>{error}</AvisoError>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="acceso-codigo-correo" className="text-[13px] font-medium text-slate-900">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="acceso-codigo-correo"
              data-primer-campo=""
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              disabled={enviando}
              className={CLASE_CAMPO}
              placeholder="tu@correo.com"
              value={correo}
              onChange={(e) => onCorreo(e.target.value)}
            />
          </div>
        </div>
        <BotonPrincipal enviando={enviando} textoEnviando="Enviando código…" icono={<Mail aria-hidden="true" className="h-4 w-4" />}>
          Recibir código
        </BotonPrincipal>
      </form>
      <div aria-hidden="true" className="flex items-center gap-2.5 text-[13px] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />o<span className="h-px flex-1 bg-slate-200" />
      </div>
      {google && (
        <a href={`/api/auth/google${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}`} className={CLASE_SECUNDARIO} data-acceso-google="">
          <Globe aria-hidden="true" className="h-4 w-4" />
          Continuar con Google
        </a>
      )}
      <button type="button" onClick={onContrasena} className={CLASE_SECUNDARIO}>
        <Lock aria-hidden="true" className="h-4 w-4" />
        Ingresar con contraseña
      </button>
      {!compacto && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5" data-compraste-sin-cuenta="">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Package aria-hidden="true" className="h-4 w-4" style={{ color: 'var(--primary-color)' }} />
            ¿Compraste sin cuenta?
          </p>
          <p className="text-[13px] leading-snug text-slate-600">
            Busca tu pedido con el número y tu correo o teléfono. Si después entras con ese correo, tus pedidos aparecen en tu cuenta.
          </p>
          <a href="/consultar-pedido" className="self-center text-sm font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
            Buscar mi pedido →
          </a>
        </div>
      )}
      <p className="text-xs leading-snug text-slate-400">Al continuar aceptas el tratamiento de tus datos según la política de privacidad de la tienda.</p>
    </div>
  )
}

export interface PasoCodigoProps {
  correo: string
  enviando: boolean
  error: string
  /** Momento (ms) en que se envió el último código: la cuenta regresiva del reenvío. */
  enviadoEn: number | null
  onCambiarCorreo: () => void
  onReenviar: () => void
  onEntrar: (codigo: string, recordarme: boolean) => void
  /** Ventana compacta: sin «Recordarme» (sesión larga de siempre). */
  compacto?: boolean
}

/** Paso 2 (B, 2975:72023): los 6 dígitos. */
export function PasoCodigo({ correo, enviando, error, enviadoEn, onCambiarCorreo, onReenviar, onEntrar, compacto = false }: PasoCodigoProps) {
  const [digitos, setDigitos] = useState<string[]>(() => Array(LARGO_CODIGO).fill(''))
  const [recordarme, setRecordarme] = useState(true)
  const [ahora, setAhora] = useState(() => Date.now())
  const cajas = useRef<(HTMLInputElement | null)[]>([])
  const ultimoEnviado = useRef<string | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  // Error del servidor: se borran los dígitos y el foco vuelve a la primera caja.
  useEffect(() => {
    if (!error) return
    setDigitos(Array(LARGO_CODIGO).fill(''))
    ultimoEnviado.current = null
    cajas.current[0]?.focus()
  }, [error])

  const codigo = digitos.join('')
  const faltan = segundosParaReenviar(enviadoEn, ahora)
  const enviar = (c: string) => {
    if (c.length !== LARGO_CODIGO || enviando || ultimoEnviado.current === c) return
    ultimoEnviado.current = c
    onEntrar(c, compacto ? true : recordarme)
  }
  const fijarDesde = (i: number, texto: string) => {
    const nuevos = texto.replace(/\D/g, '').slice(0, LARGO_CODIGO - i).split('')
    if (nuevos.length === 0) return
    const copia = [...digitos]
    nuevos.forEach((d, k) => {
      copia[i + k] = d
    })
    setDigitos(copia)
    const siguiente = Math.min(i + nuevos.length, LARGO_CODIGO - 1)
    cajas.current[siguiente]?.focus()
    const completo = copia.join('')
    if (completo.length === LARGO_CODIGO) enviar(completo)
  }

  return (
    <form
      className="flex flex-col gap-4"
      data-vista-acceso="codigo-digitos"
      onSubmit={(e) => {
        e.preventDefault()
        ultimoEnviado.current = null
        enviar(codigo)
      }}
    >
      <button type="button" onClick={onCambiarCorreo} className="flex items-center gap-1.5 self-start text-sm font-medium text-slate-600 hover:text-slate-900">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Cambiar correo
      </button>
      <p className="text-2xl font-semibold leading-snug text-slate-900">Revisa tu correo</p>
      <p className="text-[15px] leading-snug text-slate-600">
        Enviamos un código de {LARGO_CODIGO} dígitos a <span className="font-medium text-slate-900">{correo}</span>. Vence en {MINUTOS_VIGENCIA_CODIGO} minutos.
      </p>
      {error && <AvisoError>{error}</AvisoError>}
      <fieldset className="flex gap-2" aria-label={`Código de ${LARGO_CODIGO} dígitos`}>
        {digitos.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              cajas.current[i] = el
            }}
            {...(i === 0 ? { 'data-primer-campo': '' } : {})}
            aria-label={`Dígito ${i + 1}`}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={LARGO_CODIGO}
            disabled={enviando}
            value={d}
            onChange={(e) => {
              const v = e.target.value
              if (!v) {
                const copia = [...digitos]
                copia[i] = ''
                setDigitos(copia)
                return
              }
              // Caja con dígito y uno nuevo escrito encima: vale el nuevo (el autocompletado del
              // celular, en cambio, trae los seis de una vez).
              fijarDesde(i, v.length === 2 && digitos[i] && v.startsWith(digitos[i]) ? v.slice(1) : v)
            }}
            onPaste={(e) => {
              e.preventDefault()
              fijarDesde(i, e.clipboardData.getData('text'))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digitos[i] && i > 0) cajas.current[i - 1]?.focus()
              if (e.key === 'ArrowLeft' && i > 0) cajas.current[i - 1]?.focus()
              if (e.key === 'ArrowRight' && i < LARGO_CODIGO - 1) cajas.current[i + 1]?.focus()
            }}
            className="h-14 w-12 min-w-0 flex-1 rounded-[10px] border border-slate-300 bg-white text-center text-2xl font-semibold text-slate-900 outline-none focus:border-2 focus:border-[var(--primary-color)] disabled:bg-slate-50 sm:flex-none"
          />
        ))}
      </fieldset>
      <BotonPrincipal enviando={enviando} textoEnviando="Ingresando…">
        Ingresar
      </BotonPrincipal>
      <p className="flex flex-wrap items-center justify-center gap-1.5 text-[13px]">
        <span className="text-slate-600">¿No te llegó? Revisa en spam o</span>
        {faltan > 0 ? (
          <span className="font-medium text-slate-400" aria-live="polite">reenvía en {textoCuentaRegresiva(faltan)}</span>
        ) : (
          <button type="button" onClick={onReenviar} disabled={enviando} className="font-semibold hover:underline disabled:opacity-60" style={{ color: 'var(--primary-color)' }}>
            reenvía el código
          </button>
        )}
      </p>
      <p className="rounded-xl p-3.5 text-[13px] leading-snug text-slate-900" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 9%, white)' }}>
        Al entrar verás también los pedidos que hiciste sin cuenta con este correo.
      </p>
      {!compacto && (
        <label className="flex items-center gap-2.5 text-sm text-slate-900">
          <input type="checkbox" className="h-[18px] w-[18px] rounded" style={{ accentColor: 'var(--primary-color)' }} checked={recordarme} onChange={(e) => setRecordarme(e.target.checked)} />
          Recordarme en este dispositivo
        </label>
      )}
    </form>
  )
}

export interface PasoRestablecerProps {
  correo: string
  enviando: boolean
  error: string
  /** Momento (ms) en que se envió el último código: la cuenta regresiva del reenvío. */
  enviadoEn: number | null
  onCambiarCorreo: () => void
  onReenviar: () => void
  onGuardar: (datos: { codigo: string; password: string; confirmPassword: string }) => void
}

/**
 * «¿Olvidaste tu contraseña?», paso 2 (desde el 2026-11-24): el código que la tienda envió al correo
 * y la nueva contraseña, en una sola pantalla. Al guardar, la sesión queda abierta. Mismo estilo
 * que el paso de los 6 dígitos.
 */
export function PasoRestablecer({ correo, enviando, error, enviadoEn, onCambiarCorreo, onReenviar, onGuardar }: PasoRestablecerProps) {
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const faltan = segundosParaReenviar(enviadoEn, ahora)
  const claseClave = `${CLASE_CAMPO} pr-11`

  return (
    <form
      className="flex flex-col gap-4"
      data-vista-acceso="restablecer"
      onSubmit={(e) => {
        e.preventDefault()
        onGuardar({ codigo: codigo.replace(/\D/g, ''), password, confirmPassword })
      }}
    >
      <button type="button" onClick={onCambiarCorreo} className="flex items-center gap-1.5 self-start text-sm font-medium text-slate-600 hover:text-slate-900">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Cambiar correo
      </button>
      <p className="text-2xl font-semibold leading-snug text-slate-900">Revisa tu correo</p>
      <p className="text-[15px] leading-snug text-slate-600">
        Si <span className="font-medium text-slate-900">{correo}</span> tiene una cuenta en esta tienda, te enviamos un código de {LARGO_CODIGO} dígitos. Vence en {MINUTOS_VIGENCIA_CODIGO} minutos.
      </p>
      {error && <AvisoError>{error}</AvisoError>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="restablecer-codigo" className="text-[13px] font-medium text-slate-900">
          Código
        </label>
        <div className="relative">
          <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="restablecer-codigo"
            data-primer-campo=""
            required
            inputMode="numeric"
            pattern="[0-9 ]*"
            autoComplete="one-time-code"
            maxLength={LARGO_CODIGO + 2}
            disabled={enviando}
            className={`${CLASE_CAMPO} tracking-[0.3em]`}
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ''))}
          />
        </div>
      </div>
      {(
        [
          ['restablecer-clave', 'Nueva contraseña', password, setPassword, 'Mínimo 6 caracteres'],
          ['restablecer-confirmar', 'Confirmar contraseña', confirmPassword, setConfirmPassword, 'Repite tu contraseña'],
        ] as const
      ).map(([id, etiqueta, valor, fijar, ayuda], i) => (
        <div key={id} className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-[13px] font-medium text-slate-900">
            {etiqueta}
          </label>
          <div className="relative">
            <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id={id}
              type={ver ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              disabled={enviando}
              className={claseClave}
              placeholder={ayuda}
              value={valor}
              onChange={(e) => fijar(e.target.value)}
            />
            {i === 0 && (
              <button
                type="button"
                onClick={() => setVer((v) => !v)}
                aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {ver ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      ))}
      <BotonPrincipal enviando={enviando} textoEnviando="Guardando…">
        Cambiar contraseña
      </BotonPrincipal>
      <p className="flex flex-wrap items-center justify-center gap-1.5 text-[13px]">
        <span className="text-slate-600">¿No te llegó? Revisa en spam o</span>
        {faltan > 0 ? (
          <span className="font-medium text-slate-400" aria-live="polite">reenvía en {textoCuentaRegresiva(faltan)}</span>
        ) : (
          <button type="button" onClick={onReenviar} disabled={enviando} className="font-semibold hover:underline disabled:opacity-60" style={{ color: 'var(--primary-color)' }}>
            reenvía el código
          </button>
        )}
      </p>
    </form>
  )
}
