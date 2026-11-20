/**
 * `<style>` con CSS armado en el código. React 18, al pintar en el servidor, escapa el texto de un
 * `<style>{css}</style>` como HTML (`"` → `&quot;`, `>` → `&gt;`, `&` → `&amp;`), pero el navegador
 * lee el contenido de `<style>` tal cual: el CSS del servidor queda roto (`[data-lista=&quot;…&quot;]`)
 * y al hidratar el texto no coincide (errores #425/#418/#423 y la página entera se vuelve a pintar
 * en el cliente; org 358, vista «Lista», 2026-11-20). Aquí el CSS va sin escapar.
 *
 * Solo para CSS que arma el propio código (números, ids, colores ya validados). Por si un valor
 * trajera `</style`, se neutraliza para que no cierre la etiqueta.
 */
export function EstiloEnLinea({ css }: { css: string }) {
  return <style dangerouslySetInnerHTML={{ __html: css.replace(/<\/(style)/gi, '<\\/$1') }} />
}
