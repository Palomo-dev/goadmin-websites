'use client'

import Script from 'next/script'

/**
 * Widget de chat del sitio (Edge Function `chat-widget` del ERP).
 *
 * Se pinta solo si el sitio lo tiene encendido (`website_settings.chat_widget_enabled`)
 * y tiene la clave del canal «sitio web» (`chat_widget_public_key`); lo decide
 * `OrganizationLayoutCliente`. La organización y el canal los resuelve la función a
 * partir de la clave: aquí no se manda nada más.
 *
 * - La clave se valida antes de escribirla en el script en línea (y va con
 *   JSON.stringify), así un valor raro guardado en la base no inyecta código.
 * - `afterInteractive` para la cola y `lazyOnload` para el script: el chat no
 *   compite con la carga de la página. El script acepta la cola en cualquier orden.
 *   Antes la cola iba con `beforeInteractive`, que en App Router solo vale en el
 *   layout raíz.
 */
const CLAVE_VALIDA = /^pk_[A-Za-z0-9]{16,64}$/

const URL_WIDGET = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://taqjemqjtumhwptchcxk.supabase.co').replace(/\/+$/, '')}/functions/v1/chat-widget`

interface ChatWidgetProps {
  publicKey: string
}

export function ChatWidget({ publicKey }: ChatWidgetProps) {
  if (!publicKey || !CLAVE_VALIDA.test(publicKey)) return null

  return (
    <>
      <Script
        id="go-chat-queue"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.GOChatWidget=window.GOChatWidget||{q:[]};window.GOChatWidget.q.push(['init',${JSON.stringify(publicKey)}]);`,
        }}
      />
      <Script id="go-chat-widget" src={URL_WIDGET} strategy="lazyOnload" />
    </>
  )
}
