'use client'

/**
 * Formularios del acceso a la cuenta para el panel, la ventana, el diálogo y la hoja del celular
 * (Figma «16 Sitio web» 2834:68670: S1–S5, D1–D3, V1, C1–C2). La lógica de sesión es la de la
 * página /auth (useAcceso): mismos endpoints y validaciones. Aquí solo cambia la presentación:
 * - Ingresar: correo, contraseña con ojo, «Recordarme», «¿Olvidaste…?», error sin pistas.
 * - Crear cuenta: nombre, apellido, correo, celular, contraseña, confirmación y términos.
 * - Recuperar: correo → «Revisa tu correo» (la misma respuesta exista o no la cuenta).
 */
import { useId, useState, type ReactNode } from 'react'
import { AlertCircle, Eye, EyeOff, Heart, Loader2, Lock, Mail, MailCheck, MapPin, Package, User } from 'lucide-react'
import { TelefonoPais } from '@/components/site/TelefonoPais'
import { mensajeRecuperar } from '@/lib/website/v2/cabeceraTienda'
import { useAcceso, type TipoEntrada } from './useAcceso'

export type VistaFormulario = 'ingresar' | 'registro' | 'recuperar' | 'enviado'

/** Textos de la cabecera de cada vista (el de ingresar es el título del editor). */
export function tituloVista(vista: VistaFormulario, tituloIngresar: string): string {
  if (vista === 'registro') return 'Crea tu cuenta'
  if (vista === 'recuperar' || vista === 'enviado') return 'Recupera tu contraseña'
  return tituloIngresar
}

const CLASE_CAMPO =
  'h-11 w-full rounded-lg border bg-white pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)] disabled:bg-gray-50 disabled:text-gray-400'

function Campo({
  etiqueta,
  icono: Icono,
  invalido,
  error,
  children,
}: {
  etiqueta: string
  icono: typeof Mail
  invalido?: boolean
  error?: string | null
  children: (id: string, clase: string, describedBy: string | undefined) => ReactNode
}) {
  const id = useId()
  const idError = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-gray-700">
        {etiqueta}
      </label>
      <div className="relative">
        <Icono aria-hidden="true" className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${invalido ? 'text-red-500' : 'text-gray-400'}`} />
        {children(id, `${CLASE_CAMPO} ${invalido ? 'border-red-500' : 'border-gray-300'}`, error ? idError : undefined)}
      </div>
      {error && (
        <p id={idError} className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  )
}

function CampoClave({
  etiqueta,
  valor,
  onCambiar,
  placeholder,
  invalido,
  error,
  deshabilitado,
  autoComplete,
}: {
  etiqueta: string
  valor: string
  onCambiar: (v: string) => void
  placeholder: string
  invalido?: boolean
  error?: string | null
  deshabilitado?: boolean
  autoComplete: string
}) {
  const [ver, setVer] = useState(false)
  return (
    <Campo etiqueta={etiqueta} icono={Lock} invalido={invalido} error={error}>
      {(id, clase, describedBy) => (
        <>
          <input
            id={id}
            type={ver ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete={autoComplete}
            disabled={deshabilitado}
            aria-invalid={invalido || undefined}
            aria-describedby={describedBy}
            className={`${clase} pr-10`}
            placeholder={placeholder}
            value={valor}
            onChange={(e) => onCambiar(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-700"
          >
            {ver ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
          </button>
        </>
      )}
    </Campo>
  )
}

function Aviso({ tipo, children }: { tipo: 'error' | 'ok'; children: ReactNode }) {
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] leading-snug ${
        tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
      }`}
    >
      {tipo === 'error' && <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </div>
  )
}

function BotonPrincipal({ children, enviando, textoEnviando }: { children: ReactNode; enviando: boolean; textoEnviando: string }) {
  return (
    <button
      type="submit"
      disabled={enviando}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
      style={{ backgroundColor: 'var(--primary-color)' }}
    >
      {enviando ? (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {textoEnviando}
        </>
      ) : (
        children
      )}
    </button>
  )
}

const Enlace = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
    {children}
  </button>
)

const Separador = () => (
  <div aria-hidden="true" className="flex items-center gap-3 text-xs text-gray-400">
    <span className="h-px flex-1 bg-gray-200" />o<span className="h-px flex-1 bg-gray-200" />
  </div>
)

/** «Con tu cuenta puedes» (panel, diálogo y hoja; la ventana no los muestra). */
export function BeneficiosCuenta() {
  const items: { icono: typeof Package; texto: string }[] = [
    { icono: Package, texto: 'Ver tus pedidos y en qué va cada uno' },
    { icono: Heart, texto: 'Tener tus favoritos guardados en cualquier dispositivo' },
    { icono: MapPin, texto: 'Guardar tus direcciones para pagar más rápido' },
  ]
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5" data-beneficios-cuenta="">
      <p className="mb-2 text-[13px] font-semibold text-gray-900">Con tu cuenta puedes</p>
      <ul className="flex flex-col gap-2">
        {items.map(({ icono: Icono, texto }) => (
          <li key={texto} className="flex items-start gap-2 text-[13px] text-gray-700">
            <Icono aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--primary-color)' }} />
            {texto}
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface FormularioAccesoProps {
  vista: VistaFormulario
  onVista: (v: VistaFormulario) => void
  organizationId: number
  /** Texto del botón de ingresar (el del editor). */
  textoBoton: string
  /** Ventana: compacta, sin «Recordarme» ni beneficios. */
  compacto?: boolean
  beneficios?: boolean
  /** Diálogo: pestañas Ingresar / Crear cuenta arriba (Figma M4, D1). */
  pestanas?: boolean
  /**
   * «Crear cuenta» y «¿Olvidaste…?» fuera de este formulario (desde la ventana: el panel o la
   * página). Sin él, se quedan aquí.
   */
  onIrAFuera?: (vista: 'registro' | 'recuperar') => void
  alEntrar: (tipo: TipoEntrada) => void | Promise<void>
}

export function FormularioAcceso({
  vista,
  onVista,
  organizationId,
  textoBoton,
  compacto = false,
  beneficios = false,
  pestanas = false,
  onIrAFuera,
  alEntrar,
}: FormularioAccesoProps) {
  const { enviando, error, exito, limpiar, ingresar, registrar, recuperar } = useAcceso({ organizationId, alEntrar })
  const [ingreso, setIngreso] = useState({ email: '', password: '' })
  const [claveInvalida, setClaveInvalida] = useState(false)
  const [registro, setRegistro] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [correoRecuperar, setCorreoRecuperar] = useState('')

  const ir = (v: VistaFormulario) => {
    limpiar()
    setClaveInvalida(false)
    if (v === 'recuperar') setCorreoRecuperar((c) => c || ingreso.email)
    if ((v === 'registro' || v === 'recuperar') && onIrAFuera) {
      onIrAFuera(v)
      return
    }
    onVista(v)
  }

  const intro = (texto: string) => <p className="text-sm leading-snug text-gray-600">{texto}</p>

  const tabs = pestanas && (vista === 'ingresar' || vista === 'registro') && (
    <div role="tablist" aria-label="Acceso" className="flex rounded-lg bg-gray-100 p-1">
      {(['ingresar', 'registro'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={vista === v}
          onClick={() => ir(v)}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${vista === v ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
        >
          {v === 'ingresar' ? 'Ingresar' : 'Crear cuenta'}
        </button>
      ))}
    </div>
  )

  if (vista === 'enviado') {
    return (
      <div className="flex flex-col items-center gap-4 text-center" data-vista-acceso="enviado">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
          <MailCheck aria-hidden="true" className="h-6 w-6" />
        </span>
        <p className="text-lg font-semibold text-gray-900">Revisa tu correo</p>
        <p className="text-sm leading-snug text-gray-600">{mensajeRecuperar(correoRecuperar)}</p>
        <button type="button" onClick={() => ir('ingresar')} className="h-11 w-full rounded-lg border border-gray-300 text-sm font-semibold text-gray-900 hover:bg-gray-50">
          Volver a ingresar
        </button>
        <p className="text-[13px] text-gray-600">
          ¿No te llegó?{' '}
          <Enlace
            onClick={() => {
              void recuperar(correoRecuperar)
            }}
          >
            Reenviar enlace
          </Enlace>
        </p>
      </div>
    )
  }

  if (vista === 'recuperar') {
    return (
      <form
        className="flex flex-col gap-4"
        data-vista-acceso="recuperar"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await recuperar(correoRecuperar)) onVista('enviado')
        }}
      >
        {intro('Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva contraseña. Lo que tienes en el carrito se queda donde está.')}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo etiqueta="Correo electrónico" icono={Mail}>
          {(id, clase) => (
            <input id={id} data-primer-campo="" type="email" required autoComplete="email" disabled={enviando} className={clase} placeholder="tu@correo.com" value={correoRecuperar} onChange={(e) => setCorreoRecuperar(e.target.value)} />
          )}
        </Campo>
        <BotonPrincipal enviando={enviando} textoEnviando="Enviando…">
          Enviar enlace
        </BotonPrincipal>
        <p className="text-center text-[13px]">
          <Enlace onClick={() => ir('ingresar')}>Volver a ingresar</Enlace>
        </p>
      </form>
    )
  }

  if (vista === 'registro') {
    const r = registro
    const fijar = (parte: Partial<typeof registro>) => setRegistro((x) => ({ ...x, ...parte }))
    return (
      <form
        className="flex flex-col gap-4"
        data-vista-acceso="registro"
        onSubmit={async (e) => {
          e.preventDefault()
          await registrar(r)
        }}
      >
        {tabs}
        {!pestanas && intro('Crea tu cuenta para comprar más rápido y seguir tus pedidos.')}
        {error && <Aviso tipo="error">{error}</Aviso>}
        {exito && !error && <Aviso tipo="ok">{exito}</Aviso>}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Nombre" icono={User}>
            {(id, clase) => <input id={id} data-primer-campo="" required autoComplete="given-name" disabled={enviando} className={clase} placeholder="Tu nombre" value={r.firstName} onChange={(e) => fijar({ firstName: e.target.value })} />}
          </Campo>
          <Campo etiqueta="Apellido" icono={User}>
            {(id, clase) => <input id={id} required autoComplete="family-name" disabled={enviando} className={clase} placeholder="Tu apellido" value={r.lastName} onChange={(e) => fijar({ lastName: e.target.value })} />}
          </Campo>
        </div>
        <Campo etiqueta="Correo electrónico" icono={Mail}>
          {(id, clase) => <input id={id} type="email" required autoComplete="email" disabled={enviando} className={clase} placeholder="tu@correo.com" value={r.email} onChange={(e) => fijar({ email: e.target.value })} />}
        </Campo>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-gray-700">Celular</span>
          <TelefonoPais required disabled={enviando} className="rounded-lg border border-gray-300 bg-white text-sm [&_input]:h-11" value={r.phone} onChange={(v) => fijar({ phone: v })} aria-label="Celular" />
        </div>
        <CampoClave etiqueta="Contraseña" valor={r.password} onCambiar={(v) => fijar({ password: v })} placeholder="Mínimo 6 caracteres" deshabilitado={enviando} autoComplete="new-password" />
        <CampoClave etiqueta="Confirmar contraseña" valor={r.confirmPassword} onCambiar={(v) => fijar({ confirmPassword: v })} placeholder="Repite tu contraseña" deshabilitado={enviando} autoComplete="new-password" />
        <label className="flex items-start gap-2 text-[13px] text-gray-600">
          <input type="checkbox" required className="mt-0.5 rounded border-gray-300" />
          <span>
            Acepto los{' '}
            <a href="#" className="font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
              términos y condiciones
            </a>{' '}
            y la{' '}
            <a href="#" className="font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
              política de privacidad
            </a>
          </span>
        </label>
        <BotonPrincipal enviando={enviando} textoEnviando="Creando cuenta…">
          Crear cuenta
        </BotonPrincipal>
        {!pestanas && (
          <p className="text-center text-[13px] text-gray-600">
            ¿Ya tienes cuenta? <Enlace onClick={() => ir('ingresar')}>Ingresar</Enlace>
          </p>
        )}
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-vista-acceso="ingresar">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const entro = await ingresar(ingreso)
          if (!entro) {
            setClaveInvalida(true)
            setIngreso((x) => ({ ...x, password: '' }))
          }
        }}
      >
        {tabs}
        {!compacto && !pestanas && intro('Ingresa para ver tus pedidos y tener tus favoritos en cualquier dispositivo.')}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo etiqueta="Correo electrónico" icono={Mail}>
          {(id, clase) => (
            <input id={id} data-primer-campo="" type="email" required autoComplete="email" disabled={enviando} className={clase} placeholder="tu@correo.com" value={ingreso.email} onChange={(e) => setIngreso((x) => ({ ...x, email: e.target.value }))} />
          )}
        </Campo>
        <CampoClave
          etiqueta="Contraseña"
          valor={ingreso.password}
          onCambiar={(v) => {
            setClaveInvalida(false)
            setIngreso((x) => ({ ...x, password: v }))
          }}
          placeholder="Tu contraseña"
          invalido={claveInvalida && !!error}
          error={claveInvalida && error ? 'Escríbela de nuevo' : null}
          deshabilitado={enviando}
          autoComplete="current-password"
        />
        <div className={`flex items-center text-[13px] ${compacto ? 'justify-end' : 'justify-between'}`}>
          {!compacto && (
            <label className="flex items-center gap-2 text-gray-700">
              <input type="checkbox" className="rounded border-gray-300" />
              Recordarme
            </label>
          )}
          <Enlace onClick={() => ir('recuperar')}>¿Olvidaste tu contraseña?</Enlace>
        </div>
        <BotonPrincipal enviando={enviando} textoEnviando="Ingresando…">
          {textoBoton}
        </BotonPrincipal>
      </form>
      {!pestanas && (
        <>
          <Separador />
          <p className="text-center text-[13px] text-gray-600">
            ¿No tienes cuenta? <Enlace onClick={() => ir('registro')}>Crear cuenta</Enlace>
          </p>
        </>
      )}
      {beneficios && !compacto && <BeneficiosCuenta />}
    </div>
  )
}
