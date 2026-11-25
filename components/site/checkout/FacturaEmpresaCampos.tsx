'use client'

/**
 * Formulario de «Necesito factura a nombre de empresa» (Figma «16 Sitio web» › Checkout v2, A1b
 * 3138-92776 y pieza 3138-92577). Reglas y dónde se guarda: ./facturaEmpresa.ts.
 */

import { Info } from 'lucide-react'
import { avisoDV, dvAlCambiarNumero, TIPOS_DOCUMENTO_FACTURA, type CampoFactura, type DatosFactura } from './facturaEmpresa'

const ENTRADA = 'h-11 w-full rounded-lg border bg-white px-3 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-offset-1'

export function FacturaEmpresaCampos({
  factura,
  onCambio,
  errores,
  mostrarErrores,
  color,
}: {
  factura: DatosFactura
  onCambio: (f: DatosFactura) => void
  errores: Partial<Record<CampoFactura, string>>
  mostrarErrores: boolean
  color: string
}) {
  const tipo = TIPOS_DOCUMENTO_FACTURA.find((t) => t.codigo === factura.tipo) ?? TIPOS_DOCUMENTO_FACTURA[0]
  const err = (c: CampoFactura) => (mostrarErrores ? errores[c] ?? null : null)
  const estilo = (c: CampoFactura) => ({ borderColor: err(c) ? '#EF4444' : '#D1D5DB', ['--tw-ring-color' as string]: color })
  const describe = (c: CampoFactura, ayuda: string | null) => (err(c) ? `checkout-${c}-error` : ayuda ? `checkout-${c}-ayuda` : undefined)
  const nota = (c: CampoFactura, ayuda: string | null) =>
    err(c) ? (
      <p id={`checkout-${c}-error`} className="mt-1 text-xs text-red-600">{err(c)}</p>
    ) : ayuda ? (
      <p id={`checkout-${c}-ayuda`} className="mt-1 text-xs text-gray-500">{ayuda}</p>
    ) : null
  const esNit = factura.tipo === 'NIT'
  const numerico = factura.tipo === 'NIT' || factura.tipo === 'CC'

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4" data-factura-empresa="">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700">Tipo de documento</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {TIPOS_DOCUMENTO_FACTURA.map((t) => {
            const elegido = t.codigo === factura.tipo
            return (
              <button
                key={t.codigo}
                type="button"
                role="radio"
                aria-checked={elegido}
                onClick={() => onCambio({ ...factura, tipo: t.codigo, dv: t.codigo === 'NIT' ? (factura.dv || dvAlCambiarNumero({ tipo: 'NIT', numero: '', dv: '' }, factura.numero)) : '' })}
                className="rounded-full border px-3.5 py-1.5 text-sm"
                style={elegido ? { borderColor: color, color, backgroundColor: `color-mix(in srgb, ${color} 8%, white)`, fontWeight: 600 } : { borderColor: '#D1D5DB', color: '#374151' }}
              >
                {t.etiqueta}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className={esNit ? 'grid grid-cols-[1fr_5.5rem] gap-3' : ''}>
        <div>
          <label htmlFor="checkout-factura_numero" className="mb-1 block text-sm font-medium text-gray-700">{tipo.etiquetaNumero}</label>
          <input
            id="checkout-factura_numero"
            value={factura.numero}
            onChange={(e) => {
              const numero = numerico ? e.target.value.replace(/[^\d.\s-]/g, '') : e.target.value
              // NIT con 9 dígitos o más: el DV se llena con el calculado (editable).
              onCambio({ ...factura, numero, dv: dvAlCambiarNumero(factura, numero) })
            }}
            inputMode={numerico ? 'numeric' : 'text'}
            autoComplete="off"
            maxLength={20}
            aria-invalid={err('factura_numero') ? true : undefined}
            aria-describedby={describe('factura_numero', esNit ? 'Sin puntos ni guion' : null)}
            className={ENTRADA}
            style={estilo('factura_numero')}
          />
          {nota('factura_numero', esNit ? 'Sin puntos ni guion' : null)}
        </div>
        {esNit && (
          <div>
            <label htmlFor="checkout-factura_dv" className="mb-1 block text-sm font-medium text-gray-700">DV</label>
            <input
              id="checkout-factura_dv"
              value={factura.dv}
              onChange={(e) => onCambio({ ...factura, dv: e.target.value.replace(/\D/g, '').slice(0, 1) })}
              inputMode="numeric"
              autoComplete="off"
              maxLength={1}
              aria-invalid={err('factura_dv') ? true : undefined}
              aria-describedby={describe('factura_dv', 'Del RUT')}
              className={ENTRADA}
              style={estilo('factura_dv')}
            />
            {nota('factura_dv', 'Del RUT')}
          </div>
        )}
      </div>
      {/* DV distinto al calculado: aviso, no bloquea (el RUT del cliente manda). */}
      {esNit && !err('factura_dv') && avisoDV(factura) && (
        <p role="status" className="-mt-2 text-xs text-amber-700" data-aviso-dv="">{avisoDV(factura)}</p>
      )}

      <div>
        <label htmlFor="checkout-factura_razon" className="mb-1 block text-sm font-medium text-gray-700">{esNit ? 'Razón social' : 'Nombre para la factura'}</label>
        <input
          id="checkout-factura_razon"
          value={factura.razonSocial}
          onChange={(e) => onCambio({ ...factura, razonSocial: e.target.value })}
          autoComplete={esNit ? 'organization' : 'name'}
          maxLength={150}
          aria-invalid={err('factura_razon') ? true : undefined}
          aria-describedby={describe('factura_razon', esNit ? 'Como aparece en el RUT' : null)}
          className={ENTRADA}
          style={estilo('factura_razon')}
        />
        {nota('factura_razon', esNit ? 'Como aparece en el RUT' : null)}
      </div>

      <div>
        <label htmlFor="checkout-factura_correo" className="mb-1 block text-sm font-medium text-gray-700">Correo para la factura electrónica</label>
        <input
          id="checkout-factura_correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={factura.correo}
          onChange={(e) => onCambio({ ...factura, correo: e.target.value })}
          maxLength={150}
          aria-invalid={err('factura_correo') ? true : undefined}
          aria-describedby={describe('factura_correo', 'Aquí llega la factura; puede ser distinto a tu correo')}
          className={ENTRADA}
          style={estilo('factura_correo')}
        />
        {nota('factura_correo', 'Aquí llega la factura; puede ser distinto a tu correo')}
      </div>

      <p className="flex items-start gap-2 text-xs text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        Si no marcas la casilla, la factura sale a tu nombre como consumidor final.
      </p>
    </div>
  )
}
