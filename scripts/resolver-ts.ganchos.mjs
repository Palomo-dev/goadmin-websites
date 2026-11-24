/** Ganchos de resolver-ts.mjs (no lo uses suelto). */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  const relativo = specifier.startsWith('./') || specifier.startsWith('../')
  const sinExtension = !/\.[cm]?[jt]sx?$/.test(specifier)
  if (relativo && sinExtension && context.parentURL && context.parentURL.endsWith('.ts')) {
    for (const ext of ['.ts', '/index.ts']) {
      const url = new URL(specifier + ext, context.parentURL)
      if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
    }
  }
  return nextResolve(specifier, context)
}
