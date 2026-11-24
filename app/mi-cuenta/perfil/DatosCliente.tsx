'use client'

/**
 * Mis datos (Figma «16 Sitio web» F 2977:72278). Cada tarjeta guarda lo suyo en
 * PUT /api/customer/profile (`seccion`): la ficha sale de la sesión y la organización del host.
 */
import { useState, type ReactNode } from 'react'
import { CheckCircle2, Lock, Mail, ShieldCheck, Trash2 } from 'lucide-react'
import { TelefonoPais } from '@/components/site/TelefonoPais'

export interface TipoDocumentoOpcion {
  code: string
  name: string
  persona: boolean
  empresa: boolean
}

interface Props {
  correo: string | null
  personales: { first_name: string; last_name: string; phone: string; cumpleanos: string }
  factura: {
    customer_type: 'person' | 'company'
    identification_type: string
    identification_number: string
    company_name: string
    dv: string
    correo_factura: string
    ciudad: string
    completa: boolean
  }
  avisos: { whatsapp: boolean; correo: boolean; ofertas: boolean }
  autorizadoEn: string | null
  tipos: TipoDocumentoOpcion[]
  contactoEliminar: { whatsapp: string | null; correo: string | null }
  nombreTienda: string
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const CAMPO = 'h-11 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_20%,transparent)] disabled:bg-slate-100 disabled:text-slate-600'
const BOTON = 'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60'
const BOTON_BORDE = 'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60'

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

function Tarjeta({ titulo, id, insignia, children }: { titulo: string; id?: string; insignia?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4 rounded-[14px] border border-slate-200 bg-white p-5" aria-labelledby={id ? `${id}-titulo` : undefined}>
      <h2 id={id ? `${id}-titulo` : undefined} className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
        {titulo}
        {insignia}
      </h2>
      {children}
    </section>
  )
}

function Campo({ etiqueta, id, ayuda, children }: { etiqueta: string; id: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-900">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="text-xs leading-snug text-slate-600">{ayuda}</p>}
    </div>
  )
}

function Aviso({ m }: { m: Mensaje }) {
  if (!m) return null
  return (
    <p role={m.tipo === 'error' ? 'alert' : 'status'} className={`text-sm ${m.tipo === 'error' ? 'text-red-700' : 'text-green-700'}`}>
      {m.texto}
    </p>
  )
}

function Interruptor({ activo, onCambiar, etiqueta, ayuda, deshabilitado }: { activo: boolean; onCambiar: (v: boolean) => void; etiqueta: string; ayuda?: string; deshabilitado?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        disabled={deshabilitado}
        onClick={() => onCambiar(!activo)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60 ${activo ? '' : 'bg-slate-300'}`}
        style={activo ? { backgroundColor: 'var(--primary-color)' } : undefined}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${activo ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-slate-900">{etiqueta}</span>
        {ayuda && <span className="text-xs text-slate-600">{ayuda}</span>}
      </span>
    </div>
  )
}

async function guardar(datos: Record<string, unknown>): Promise<Mensaje> {
  try {
    const res = await fetch('/api/customer/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
    const j = await res.json().catch(() => ({}))
    return res.ok ? { tipo: 'ok', texto: 'Guardado' } : { tipo: 'error', texto: j.error || 'No pudimos guardar los cambios' }
  } catch {
    return { tipo: 'error', texto: 'Revisa tu conexión e intenta de nuevo' }
  }
}

export function DatosCliente({ correo, personales, factura, avisos, autorizadoEn, tipos, contactoEliminar, nombreTienda }: Props) {
  const [p, setP] = useState(personales)
  const [f, setF] = useState(factura)
  const [a, setA] = useState(avisos)
  const [msgP, setMsgP] = useState<Mensaje>(null)
  const [msgF, setMsgF] = useState<Mensaje>(null)
  const [msgA, setMsgA] = useState<Mensaje>(null)
  const [msgS, setMsgS] = useState<Mensaje>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [clave, setClave] = useState<{ abierta: boolean; password: string; confirmPassword: string }>({ abierta: false, password: '', confirmPassword: '' })
  const [eliminar, setEliminar] = useState(false)

  const [cumple, setCumple] = useState(() => {
    const [mes, dia] = personales.cumpleanos ? personales.cumpleanos.split('-') : ['', '']
    return { mes: mes ? String(Number(mes)) : '', dia: dia ? String(Number(dia)) : '' }
  })
  const tiposDe = tipos.filter((t) => (f.customer_type === 'company' ? t.empresa : t.persona))
  const fecha = autorizadoEn ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(autorizadoEn)) : null

  const guardarAvisos = async (nuevo: typeof a, cambioOfertas: boolean) => {
    const antes = a
    setA(nuevo)
    setOcupado('avisos')
    const m = await guardar({ seccion: 'avisos', whatsapp: nuevo.whatsapp, correo: nuevo.correo, ...(cambioOfertas ? { ofertas: nuevo.ofertas } : {}) })
    if (m?.tipo === 'error') setA(antes)
    setMsgA(m)
    setOcupado(null)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Datos personales */}
      <Tarjeta titulo="Datos personales">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setOcupado('personales')
            const cumpleanos = cumple.mes && cumple.dia ? `${cumple.mes.padStart(2, '0')}-${cumple.dia.padStart(2, '0')}` : ''
            setMsgP(await guardar({ seccion: 'personales', ...p, cumpleanos }))
            setOcupado(null)
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Campo etiqueta="Nombre" id="dato-nombre">
              <input id="dato-nombre" className={CAMPO} autoComplete="given-name" value={p.first_name} onChange={(e) => setP({ ...p, first_name: e.target.value })} />
            </Campo>
            <Campo etiqueta="Apellido" id="dato-apellido">
              <input id="dato-apellido" className={CAMPO} autoComplete="family-name" value={p.last_name} onChange={(e) => setP({ ...p, last_name: e.target.value })} />
            </Campo>
            <Campo etiqueta="Correo" id="dato-correo" ayuda="Es con el que entras a tu cuenta.">
              <div className="relative">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="dato-correo" className={`${CAMPO} pl-9`} value={correo ?? ''} disabled readOnly />
              </div>
            </Campo>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-900">Celular</span>
              <TelefonoPais className="rounded-[10px] border border-slate-300 bg-white text-[15px] [&_input]:h-11" value={p.phone} onChange={(v) => setP({ ...p, phone: v })} aria-label="Celular" />
              <p className="text-xs text-slate-600">Para avisos de tu pedido por WhatsApp.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-900" id="dato-cumple">Fecha de nacimiento (opcional)</span>
              <div className="flex gap-2" role="group" aria-labelledby="dato-cumple">
                <select
                  aria-label="Día"
                  className={`${CAMPO} w-24`}
                  value={cumple.dia}
                  onChange={(e) => setCumple({ ...cumple, dia: e.target.value })}
                >
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Mes"
                  className={CAMPO}
                  value={cumple.mes}
                  onChange={(e) => setCumple({ ...cumple, mes: e.target.value })}
                >
                  <option value="">Mes</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-600">Para tu cupón de cumpleaños.</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Aviso m={msgP} />
            <button type="submit" className={BOTON} style={{ backgroundColor: 'var(--primary-color)' }} disabled={ocupado === 'personales'}>
              {ocupado === 'personales' ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Tarjeta>

      {/* Factura electrónica */}
      <Tarjeta
        titulo="Datos para la factura electrónica"
        id="factura"
        insignia={!f.completa ? <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">Faltan datos</span> : null}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setOcupado('factura')
            const m = await guardar({ seccion: 'factura', ...f })
            setMsgF(m)
            if (m?.tipo === 'ok') setF((x) => ({ ...x, completa: !!x.identification_type && !!x.identification_number && (x.customer_type !== 'company' || !!x.company_name) }))
            setOcupado(null)
          }}
        >
          <p className="-mt-2 text-sm text-slate-600">Se usan en cada compra para que la factura salga a tu nombre o al de tu empresa.</p>
          <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Tipo de persona">
            {(
              [
                ['person', 'Persona natural'],
                ['company', 'Empresa'],
              ] as const
            ).map(([valor, texto]) => {
              const sel = f.customer_type === valor
              return (
                <label
                  key={valor}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-3 text-[15px] font-medium ${sel ? '' : 'border-slate-300 text-slate-900'}`}
                  style={sel ? { borderColor: 'var(--primary-color)', backgroundColor: 'color-mix(in srgb, var(--primary-color) 8%, white)' } : undefined}
                >
                  <input
                    type="radio"
                    name="tipo-persona"
                    value={valor}
                    checked={sel}
                    onChange={() => {
                      const siguen = tipos.filter((t) => (valor === 'company' ? t.empresa : t.persona)).some((t) => t.code === f.identification_type)
                      setF({ ...f, customer_type: valor, identification_type: siguen ? f.identification_type : valor === 'company' ? 'nit' : '' })
                    }}
                    style={{ accentColor: 'var(--primary-color)' }}
                  />
                  {texto}
                </label>
              )
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {f.customer_type === 'company' && (
              <Campo etiqueta="Razón social" id="factura-razon">
                <input id="factura-razon" className={CAMPO} value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} />
              </Campo>
            )}
            <Campo etiqueta="Tipo de documento" id="factura-tipo">
              <select id="factura-tipo" className={CAMPO} value={f.identification_type} onChange={(e) => setF({ ...f, identification_type: e.target.value })}>
                <option value="">Elige uno</option>
                {tiposDe.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="flex gap-2">
              <div className="flex-1">
                <Campo etiqueta="Número" id="factura-numero">
                  <input id="factura-numero" className={CAMPO} inputMode="text" value={f.identification_number} onChange={(e) => setF({ ...f, identification_number: e.target.value })} />
                </Campo>
              </div>
              {f.customer_type === 'company' && f.identification_type === 'nit' && (
                <div className="w-20">
                  <Campo etiqueta="DV" id="factura-dv">
                    <input id="factura-dv" className={CAMPO} inputMode="numeric" maxLength={1} value={f.dv} onChange={(e) => setF({ ...f, dv: e.target.value.replace(/\D/g, '').slice(0, 1) })} />
                  </Campo>
                </div>
              )}
            </div>
            <Campo etiqueta="Correo para facturas" id="factura-correo" ayuda={`Si lo dejas vacío, usamos ${correo ?? 'el de tu cuenta'}.`}>
              <input id="factura-correo" type="email" className={CAMPO} placeholder={correo ?? ''} value={f.correo_factura} onChange={(e) => setF({ ...f, correo_factura: e.target.value })} />
            </Campo>
            <Campo etiqueta="Ciudad" id="factura-ciudad" ayuda="La de tu dirección principal. Cámbiala en Direcciones.">
              <input id="factura-ciudad" className={CAMPO} value={f.ciudad} disabled readOnly />
            </Campo>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Aviso m={msgF} />
            <button type="submit" className={BOTON} style={{ backgroundColor: 'var(--primary-color)' }} disabled={ocupado === 'factura'}>
              {ocupado === 'factura' ? 'Guardando…' : 'Guardar datos de factura'}
            </button>
          </div>
        </form>
      </Tarjeta>

      {/* Avisos y privacidad */}
      <Tarjeta titulo="Avisos y privacidad">
        <div className="flex flex-col gap-4">
          <Interruptor activo={a.whatsapp} deshabilitado={ocupado === 'avisos'} onCambiar={(v) => void guardarAvisos({ ...a, whatsapp: v }, false)} etiqueta="Avisos de mis pedidos por WhatsApp" ayuda="Confirmación, salida, llegada y novedades." />
          <Interruptor activo={a.correo} deshabilitado={ocupado === 'avisos'} onCambiar={(v) => void guardarAvisos({ ...a, correo: v }, false)} etiqueta="Avisos de mis pedidos por correo" />
          <Interruptor activo={a.ofertas} deshabilitado={ocupado === 'avisos'} onCambiar={(v) => void guardarAvisos({ ...a, ofertas: v }, true)} etiqueta={`Ofertas y novedades de ${nombreTienda}`} ayuda="Puedes cambiarlo cuando quieras." />
          <Aviso m={msgA} />
          {fecha && (
            <p className="flex items-center gap-2 text-[13px] text-slate-600">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-green-600" />
              Autorizaste el tratamiento de tus datos el {fecha}.
            </p>
          )}
        </div>
      </Tarjeta>

      {/* Seguridad */}
      <Tarjeta titulo="Seguridad">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Contraseña</p>
                <p className="text-[13px] text-slate-600">Opcional: puedes entrar siempre con un código al correo.</p>
              </div>
              <button type="button" className={BOTON_BORDE} onClick={() => setClave((c) => ({ ...c, abierta: !c.abierta }))} aria-expanded={clave.abierta}>
                <Lock aria-hidden="true" className="h-4 w-4" /> Crear o cambiar contraseña
              </button>
            </div>
            {clave.abierta && (
              <form
                className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setOcupado('clave')
                  try {
                    const res = await fetch('/api/customer/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: clave.password, confirmPassword: clave.confirmPassword }) })
                    const j = await res.json().catch(() => ({}))
                    setMsgS(res.ok ? { tipo: 'ok', texto: 'Contraseña guardada' } : { tipo: 'error', texto: j.error || 'No pudimos guardar la contraseña' })
                    if (res.ok) setClave({ abierta: false, password: '', confirmPassword: '' })
                  } catch {
                    setMsgS({ tipo: 'error', texto: 'Revisa tu conexión e intenta de nuevo' })
                  }
                  setOcupado(null)
                }}
              >
                <Campo etiqueta="Nueva contraseña" id="clave-nueva">
                  <input id="clave-nueva" type="password" autoComplete="new-password" minLength={6} required className={CAMPO} value={clave.password} onChange={(e) => setClave({ ...clave, password: e.target.value })} />
                </Campo>
                <Campo etiqueta="Repítela" id="clave-repetir">
                  <input id="clave-repetir" type="password" autoComplete="new-password" minLength={6} required className={CAMPO} value={clave.confirmPassword} onChange={(e) => setClave({ ...clave, confirmPassword: e.target.value })} />
                </Campo>
                <button type="submit" className={BOTON} style={{ backgroundColor: 'var(--primary-color)' }} disabled={ocupado === 'clave'}>
                  {ocupado === 'clave' ? 'Guardando…' : 'Guardar'}
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Sesiones abiertas</p>
              <p className="text-[13px] text-slate-600">Cierra tu cuenta en los demás navegadores y celulares. Esta sigue abierta.</p>
            </div>
            <button
              type="button"
              className={BOTON_BORDE}
              disabled={ocupado === 'sesiones'}
              onClick={async () => {
                setOcupado('sesiones')
                try {
                  const res = await fetch('/api/customer/sesiones', { method: 'POST' })
                  setMsgS(res.ok ? { tipo: 'ok', texto: 'Cerramos las demás sesiones' } : { tipo: 'error', texto: 'No pudimos cerrar las demás sesiones' })
                } catch {
                  setMsgS({ tipo: 'error', texto: 'Revisa tu conexión e intenta de nuevo' })
                }
                setOcupado(null)
              }}
            >
              {ocupado === 'sesiones' ? 'Cerrando…' : 'Cerrar las demás'}
            </button>
          </div>
          <Aviso m={msgS} />
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-red-700">Eliminar mi cuenta</p>
                <p className="text-[13px] text-slate-600">Borramos tus datos personales. Las facturas se conservan por ley.</p>
              </div>
              <button type="button" className={`${BOTON_BORDE} border-red-200 text-red-700 hover:bg-red-50`} onClick={() => setEliminar((v) => !v)} aria-expanded={eliminar}>
                <Trash2 aria-hidden="true" className="h-4 w-4" /> Solicitar eliminación
              </button>
            </div>
            {eliminar && (
              <div className="flex flex-col gap-2 rounded-[10px] border border-red-200 bg-red-50 p-4 text-[13px] text-slate-700">
                <p>
                  La eliminación la hace la tienda para conservar lo que exige la ley (facturas y pagos). Escríbele desde el correo de tu cuenta y te confirmará cuando esté lista.
                </p>
                <div className="flex flex-wrap gap-2">
                  {contactoEliminar.whatsapp && (
                    <a href={contactoEliminar.whatsapp} target="_blank" rel="noopener noreferrer" className={BOTON_BORDE}>
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Pedirlo por WhatsApp
                    </a>
                  )}
                  {contactoEliminar.correo && (
                    <a
                      href={`mailto:${contactoEliminar.correo}?subject=${encodeURIComponent('Solicitud de eliminación de mi cuenta')}&body=${encodeURIComponent(`Hola, quiero eliminar mi cuenta de ${nombreTienda} (${correo ?? ''}).`)}`}
                      className={BOTON_BORDE}
                    >
                      <Mail aria-hidden="true" className="h-4 w-4" /> Pedirlo por correo
                    </a>
                  )}
                  {!contactoEliminar.whatsapp && !contactoEliminar.correo && <p>Usa los datos de contacto de la tienda que aparecen al pie de la página.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </Tarjeta>
    </div>
  )
}
