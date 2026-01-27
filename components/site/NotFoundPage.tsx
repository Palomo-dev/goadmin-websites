'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface NotFoundPageProps {
  subdomain?: string
}

export function NotFoundPage({ subdomain }: NotFoundPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-3xl">GO</span>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {subdomain ? 'Sitio no encontrado' : 'Bienvenido a GO Admin'}
        </h1>
        
        <p className="text-gray-600 mb-8">
          {subdomain 
            ? `El sitio "${subdomain}" no existe o no está disponible.`
            : 'Esta es la plataforma de sitios web para clientes de GO Admin ERP.'
          }
        </p>
        
        <div className="space-y-3">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => window.open('https://app.goadmin.io', '_blank')}
          >
            Ir a GO Admin ERP
          </Button>
          
          <p className="text-sm text-gray-500">
            ¿Tienes una cuenta? Inicia sesión en el panel de administración para configurar tu sitio web.
          </p>
        </div>
      </div>
    </div>
  )
}
