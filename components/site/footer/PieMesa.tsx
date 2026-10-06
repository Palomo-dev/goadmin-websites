/**
 * Pie de la Carta QR en la mesa (Figma 2032:75742, lámina 01): solo «Carta con tecnología
 * GO Admin», con el texto del tema. Si la organización apagó «Hecho con GO Admin»
 * (`show_powered_by = false`), el pie queda como un margen vacío.
 */
export function PieMesa({ mostrarMarca }: { mostrarMarca: boolean }) {
  return (
    <footer
      className="w-full px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 text-center text-xs md:pb-8"
      style={{ backgroundColor: 'var(--background-color)', color: 'color-mix(in srgb, var(--text-color) 68%, var(--background-color))' }}
      data-pie-mesa=""
    >
      {mostrarMarca ? <p>Carta con tecnología GO Admin</p> : null}
    </footer>
  )
}
