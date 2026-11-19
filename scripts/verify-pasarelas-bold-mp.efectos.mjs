/**
 * Efectos de salida falsos para `verify-pasarelas-bold-mp.mjs`: registran la llamada y no hacen
 * nada más. Los carga `verify-pasarelas-bold-mp.cargador.mjs` en lugar de los reales.
 */
// La lista se lee en cada llamada: la prueba la reinicia entre casos.
const registrar = (nombre) => async (...args) => {
  ;(globalThis.__efectosPago ??= []).push({ nombre, args })
}

export const uploadGoogleAdsConversion = registrar('googleAds')
export const sendMetaCAPIEvent = registrar('metaCapi')
export const notifyErpAutoConfirm = registrar('erpAutoConfirm')
export const notifyErpReleaseStock = registrar('erpReleaseStock')
export const notifyErpRefund = registrar('erpRefund')
export const enviarCorreoPedidoPagado = registrar('correoPagado')
