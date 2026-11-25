/**
 * Anticipo pagado con el pedido VENCIDO (Figma «05 POS y ventas» 3181-202769 › 11a / 12a; ERP
 * 20261125121000). Código puro: sin Next, Supabase ni red. Lo prueba scripts/verify-anticipo-tardio.mjs.
 *
 * La base (`fn_web_order_anticipo_resultado`) registra el pago y, si el pedido había vencido, decide:
 * - `pagado_tarde_reactivable`: llegó hasta 24 h después de vencer y había stock de todo; el pedido
 *   volvió a «Pendiente» con el stock apartado. Se pide al ERP la confirmación de siempre y el
 *   cliente recibe «Tu pedido sigue en pie».
 * - `pagado_vencido_sin_stock` / `pagado_vencido_fuera_de_plazo`: queda «Anticipo pagado · vencido»
 *   y decide una persona en el ERP. El cliente recibe «Recibimos tu pago, lo estamos revisando» y el
 *   ERP le manda el WhatsApp (por eso también se le avisa).
 * Nunca se devuelve dinero aquí: la devolución la hace una persona en el ERP.
 */

export type CorreoAnticipoTardio = 'reactivado' | 'revisando'

export interface AccionAnticipoTardio {
  correo: CorreoAnticipoTardio
  /** Avisar al ERP (`/api/web-orders/[id]/auto-confirm`): confirma el reactivado o avisa el WhatsApp «revisando». */
  avisarErp: true
}

/** Qué hacer con la respuesta de la base. `null` = nada nuevo (los demás estados siguen como antes). */
export function accionAnticipoTardio(status: string | null | undefined): AccionAnticipoTardio | null {
  if (status === 'pagado_tarde_reactivable') return { correo: 'reactivado', avisarErp: true }
  if (status === 'pagado_vencido_sin_stock' || status === 'pagado_vencido_fuera_de_plazo') {
    return { correo: 'revisando', avisarErp: true }
  }
  return null
}

export interface DatosCorreoAnticipoTardio {
  nombreCliente: string
  numeroPedido: string
  /** Ya formateados en la moneda de la tienda. */
  anticipo: string
  alRecibir: string | null
  /** Hora del pago y del vencimiento en la zona de la sede («10:02 p. m.»). */
  horaPago: string
  horaVencio: string | null
  /** «hoy alrededor de las 10:40 p. m.»; null si aún no hay estimado. */
  listoAprox: string | null
  entregaAprox: string | null
  lineas: string | null
  urlPedido: string | null
  pie: string
}

export interface SobreSimple {
  nombre: string
  logoUrl: string | null
  color: string
  texto: string
}

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || 'cliente'
}

/** Asunto, HTML y texto del correo (11a «sigue en pie» y 12a «lo estamos revisando»). */
export function armarCorreoAnticipoTardio(
  tipo: CorreoAnticipoTardio,
  d: DatosCorreoAnticipoTardio,
  sobre: SobreSimple,
): { asunto: string; html: string; texto: string } {
  const nombre = primerNombre(d.nombreCliente)
  const parrafos: string[] = []
  if (tipo === 'reactivado') {
    parrafos.push(`Recibimos tu pago de ${d.anticipo} a las ${d.horaPago}. Llegó después del plazo, pero todavía teníamos todo, así que tu pedido sigue en pie.`)
    const horas = [
      d.listoAprox ? `Lo tendremos listo ${d.listoAprox}` : null,
      d.entregaAprox ? `te llega ${d.entregaAprox}` : null,
    ].filter(Boolean).join(' y ')
    parrafos.push(horas ? `${horas}.` : 'Te avisamos en cuanto salga para tu dirección.')
  } else {
    parrafos.push(
      `Recibimos tu pago de ${d.anticipo} a las ${d.horaPago}.${d.horaVencio ? ` Tu pedido había vencido a las ${d.horaVencio} y, mientras tanto, se agotaron algunos productos.` : ' Tu pedido ya había vencido.'}`,
    )
    parrafos.push('Estamos revisando qué hacer: reemplazarlos, esperar a que lleguen o devolverte el dinero. Te escribimos en las próximas horas.')
    parrafos.push('Tu dinero está seguro: si no podemos atender el pedido, te lo devolvemos completo.')
  }
  const asunto = tipo === 'reactivado'
    ? `Tu pedido ${d.numeroPedido} sigue en pie`
    : `Recibimos tu pago del pedido ${d.numeroPedido}`

  const resumen = tipo === 'reactivado'
    ? `<div style="background:#F8FAFC;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;color:#334155;">
${d.lineas ? `<p style="margin:0 0 8px;">${escapar(d.lineas)}</p>` : ''}
<table style="width:100%;border-collapse:collapse;font-size:14px;">
<tr><td style="color:#64748B;padding:2px 0;">Pagaste hoy</td><td style="text-align:right;padding:2px 0;">${escapar(d.anticipo)}</td></tr>
${d.alRecibir ? `<tr><td style="font-weight:600;padding:2px 0;">Pagas al recibir</td><td style="text-align:right;font-weight:600;padding:2px 0;">${escapar(d.alRecibir)}</td></tr>` : ''}
</table></div>`
    : ''
  const boton = tipo === 'reactivado' && d.urlPedido
    ? `<div style="margin-top:20px;"><a href="${escapar(d.urlPedido)}" style="display:inline-block;background:${escapar(sobre.color)};color:${escapar(sobre.texto)};padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Ver mi pedido</a></div>`
    : ''
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
<div style="background:${escapar(sobre.color)};padding:16px 24px;color:${escapar(sobre.texto)};font-size:16px;font-weight:600;">
${sobre.logoUrl ? `<img src="${escapar(sobre.logoUrl)}" alt="${escapar(sobre.nombre)}" style="max-height:32px;vertical-align:middle;margin-right:8px;border:0;">` : ''}${escapar(sobre.nombre)}
</div>
<div style="padding:24px;color:#0F172A;font-size:15px;line-height:1.5;">
<p style="margin:0 0 12px;">Hola ${escapar(nombre)},</p>
${parrafos.map((p) => `<p style="margin:0 0 12px;">${escapar(p)}</p>`).join('\n')}
${resumen}${boton}
</div>
<div style="border-top:1px solid #E2E8F0;padding:12px 24px;color:#64748B;font-size:12px;">${escapar(d.pie)}</div>
</div>`
  const texto = [
    `Hola ${nombre},`,
    ...parrafos,
    tipo === 'reactivado' && d.lineas ? d.lineas : null,
    tipo === 'reactivado' ? `Pagaste hoy: ${d.anticipo}` : null,
    tipo === 'reactivado' && d.alRecibir ? `Pagas al recibir: ${d.alRecibir}` : null,
    tipo === 'reactivado' && d.urlPedido ? `Ver mi pedido: ${d.urlPedido}` : null,
    d.pie,
  ].filter(Boolean).join('\n\n')
  return { asunto, html, texto }
}
