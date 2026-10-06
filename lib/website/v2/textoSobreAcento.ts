/**
 * Texto sobre el acento: negro o blanco, el de más contraste. MISMA regla que el editor del ERP.
 *
 * La función de abajo es una copia literal de `textoSobreAcento` de
 * go-admin-erp/src/lib/website/v2/tokensEstilo.ts. Ese archivo no se puede copiar entero (importa
 * con alias `@/` y arrastra el contrato de edición), así que `npm run verify:copias` compara el
 * cuerpo de la función, byte a byte, con el del ERP (COPIAS_FUNCIONES). No la edites aquí: cámbiala
 * en el ERP y vuelve a copiarla. `contraste` sale de ./contrasteColor, copia entera del ERP.
 *
 * Código puro: sin React, Next ni Supabase.
 */
import { contraste, hexARgb } from './contrasteColor'

/** Texto que se lee sobre el acento (negro o blanco, el de más contraste): «on-accent» calculado, no guardado. */
export function textoSobreAcento(acento: string): string {
  const negro = contraste(acento, '#111111') ?? 0;
  const blanco = contraste(acento, '#FFFFFF') ?? 0;
  return negro >= blanco ? '#111111' : '#FFFFFF';
}

/**
 * Lo mismo, pero solo para un hex válido: con otro valor (un `rgb()`, una referencia sin resolver)
 * devuelve `null` y quien llama conserva su color de siempre. `textoSobreAcento` con un valor
 * inválido respondería negro sin haber medido nada.
 */
export function textoSobreAcentoSiHex(acento: unknown): string | null {
  return typeof acento === 'string' && hexARgb(acento) ? textoSobreAcento(acento) : null
}

/** ¿El fondo es oscuro? Mismo criterio: sobre él se lee mejor el blanco que el negro. */
export function fondoOscuro(fondo: string): boolean {
  return textoSobreAcentoSiHex(fondo) === '#FFFFFF'
}
