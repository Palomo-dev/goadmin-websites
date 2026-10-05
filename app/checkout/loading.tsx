/**
 * Mientras el servidor arma /checkout (organización, métodos de pago,
 * impuesto, ajustes), el navegador no mostraba nada: «Comprar ahora» parecía
 * colgado. Este límite de carga se pinta al instante en la navegación desde
 * cualquier botón que lleve al checkout y deja que `router.prefetch` lo
 * traiga por adelantado.
 */
export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" aria-busy="true">
      <header className="bg-white border-b py-2 md:py-3 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="h-4 w-28 rounded bg-gray-100 animate-pulse" />
          <div className="h-8 md:h-12 w-24 rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
        </div>
      </header>
      <main className="flex-grow flex items-center justify-center px-4">
        <div role="status" className="flex flex-col items-center gap-3 text-gray-500">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p className="text-sm">Preparando tu pedido…</p>
        </div>
      </main>
    </div>
  )
}
