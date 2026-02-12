'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

interface MembershipQRProps {
  accessCode: string
  memberName?: string
  primaryColor?: string
}

export function MembershipQR({ accessCode, memberName, primaryColor = '#3B82F6' }: MembershipQRProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📱</span>
          <span className="font-medium text-sm">Mi código QR de acceso</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col items-center gap-3 p-6 bg-white rounded-xl border">
          <div className="p-3 bg-white rounded-xl shadow-sm border">
            <QRCodeSVG
              value={accessCode}
              size={200}
              level="M"
              fgColor="#1a1a1a"
              bgColor="#ffffff"
            />
          </div>
          {memberName && (
            <p className="text-sm font-medium text-gray-700">{memberName}</p>
          )}
          <p className="text-xs text-gray-400 font-mono tracking-wider">{accessCode}</p>
          <p className="text-xs text-gray-500 text-center max-w-[220px]">
            Muestra este código en la entrada del gimnasio para registrar tu acceso
          </p>
        </div>
      )}
    </div>
  )
}
