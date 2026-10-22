/**
 * El boletín nuevo no se activa con las claves de hoy.
 * Sin base de datos.
 */
import { leerBoletin, precargaBoletin, validarEnvio } from '../lib/website/boletin.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(leerBoletin({}) === null, 'sin claves no hay boletín nuevo')
check(leerBoletin({ title: 'Únete', subtitle: 'Novedades', button_text: 'Suscribirme', layout: 'centered' }) === null, 'el título y el layout viejo no cambian la variante')
check(leerBoletin({ image_url: 'https://cdn.ejemplo/a.jpg', disclaimer: 'Aviso' }) === null, 'la imagen de hoy no cambia la variante')
check(leerBoletin({ newsletter_layout: 'raro' }) === null, 'un preset desconocido no se aplica')
check(leerBoletin({ newsletter_layout: 'image_left' })?.layout === 'image_left', 'image_left sí cambia')
check(leerBoletin({ newsletter_layout: 'centered' })?.align === 'center', 'centrado alinea al centro')
check(leerBoletin({ newsletter_layout: 'inline_bar' })?.align === 'left', 'la franja alinea a la izquierda')
check(leerBoletin({ newsletter_layout: 'card_floating', newsletter: precargaBoletin('card_floating') })?.background?.gradient?.length === 2, 'la tarjeta flotante trae degradado')
check(leerBoletin({ newsletter: { media: { desktop: 'javascript:alert(1)' } } })?.media == null, 'una imagen insegura no se usa')
check(leerBoletin({ newsletter_layout: 'image_right', image_url: '/foto.jpg' })?.media?.desktop === '/foto.jpg', 'la foto ya guardada se usa en el preset')
check(leerBoletin({ newsletter: { form: { show_name: true, show_phone: true, arrangement: 'inside' } } })?.form.showName === true, 'el nombre es opcional y se puede pedir')
check(leerBoletin({ newsletter: { form: { show_consent: true } } })?.form.showConsent === true, 'la aceptación se pide solo si se enciende')
check(leerBoletin({ title: 'Hola', newsletter_layout: 'centered' })?.title.text === 'Hola', 'el título de hoy se sigue leyendo')
check(leerBoletin({ newsletter: { texts: { eyebrow: 'Nuevo', eyebrow_size: 'lg', description_weight: 'bold', legal_font: 'Georgia' } } })?.eyebrow?.size === 'lg', 'la ceja tiene tamaño propio')
check(leerBoletin({ newsletter: { texts: { description_weight: 'bold' } } })?.description?.weight === 'bold', 'la descripción tiene peso propio')
const campo = leerBoletin({ newsletter: { form: { input: { placeholder_color: '#112233', size: 'lg' }, button: { size: 'sm', hover: '#abcdef' } } } })?.form
check(campo?.input.size === 'lg' && campo?.input.placeholderColor === '#112233' && campo?.button.size === 'sm' && campo?.button.hover === '#abcdef', 'el campo y el botón leen tamaño, placeholder y hover')
check(validarEnvio('no-es-correo', false, false) === 'correo', 'un correo mal formado no pasa')
check(validarEnvio('ana@correo.co', false, true) === 'aceptacion', 'sin la casilla de datos no pasa')
check(validarEnvio('ana@correo.co', true, true) === 'ok', 'correo y aceptación pasan')
check(!('title' in precargaBoletin('centered')), 'el preset no pisa el título')
check(precargaBoletin('centered').background == null, 'centrado no inventa un fondo')

const layouts = ['centered', 'image_left', 'image_right', 'image_top', 'image_bottom', 'card_floating', 'inline_bar', 'split_bg']
for (const id of layouts) {
  check(leerBoletin({ newsletter_layout: id })?.layout === id, `el preset ${id} se lee`)
}

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
