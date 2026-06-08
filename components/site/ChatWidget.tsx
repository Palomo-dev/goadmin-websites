'use client'

import Script from 'next/script'

interface ChatWidgetProps {
  publicKey: string
}

export function ChatWidget({ publicKey }: ChatWidgetProps) {
  if (!publicKey) return null

  return (
    <>
      <Script
        id="go-chat-queue"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.GOChatWidget=window.GOChatWidget||{q:[]};window.GOChatWidget.q.push(['init','${publicKey}']);`,
        }}
      />
      <Script
        src="https://jgmgphmzusbluqhuqihj.supabase.co/functions/v1/chat-widget"
        strategy="afterInteractive"
      />
    </>
  )
}
