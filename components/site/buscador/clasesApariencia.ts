/**
 * Estados de la barra con apariencia (Figma 3248:99253): cursor encima = borde un tono más oscuro;
 * foco = «Borde al enfocar» + sombra al enfocar + anillo de foco de 2 px que nunca se apaga. Leen
 * las variables `--bq-*` de `variablesApariencia` (lib/website/v2/aparienciaBuscador.ts).
 * Clases literales para que Tailwind las emita.
 */
export const CLASES_CAJA_APARIENCIA =
  'transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none border-[color:var(--bq-borde)] hover:border-[color:var(--bq-borde-hover)] focus-within:border-[color:var(--bq-borde-foco)] [box-shadow:var(--bq-sombra)] focus-within:[box-shadow:var(--bq-sombra-foco)]'

/** El texto y la ayuda del campo dentro de la barra con apariencia. */
export const CLASES_CAMPO_APARIENCIA =
  'min-w-0 border-0 bg-transparent outline-none text-[color:var(--bq-texto)] placeholder:text-[color:var(--bq-ayuda)]'
