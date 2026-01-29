'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Users, Search, Star, MapPin } from 'lucide-react'

interface HeroBookingProps {
  organizationName: string
  tagline?: string
  primaryColor: string
  backgroundImage?: string
  rating?: number
  location?: string
}

export function HeroBooking({ 
  organizationName, 
  tagline, 
  primaryColor, 
  backgroundImage,
  rating = 4.8,
  location
}: HeroBookingProps) {
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [guests, setGuests] = useState('2')
  
  return (
    <section 
      className="relative min-h-[700px] flex items-center"
      style={{
        background: backgroundImage 
          ? `linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%), url(${backgroundImage}) center/cover`
          : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 50%, #1a1a2e 100%)`
      }}
    >
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="flex items-center gap-4 mb-6">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
              🏨 Hotel
            </span>
            {rating && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-400/90 text-yellow-900 text-sm font-medium">
                <Star className="w-4 h-4 fill-current mr-1" />
                {rating}
              </span>
            )}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
            {organizationName}
          </h1>
          
          {location && (
            <p className="flex items-center text-white/80 text-lg mb-4">
              <MapPin className="w-5 h-5 mr-2" />
              {location}
            </p>
          )}
          
          <p className="text-xl text-white/90 mb-10 max-w-xl">
            {tagline || 'Vive una experiencia única con el confort y la elegancia que mereces. Tu hogar lejos de casa.'}
          </p>
          
          {/* Booking form */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Check-in
                </label>
                <Input
                  type="date"
                  value={checkin}
                  onChange={(e) => setCheckin(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Check-out
                </label>
                <Input
                  type="date"
                  value={checkout}
                  onChange={(e) => setCheckout(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Huéspedes
                </label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[1,2,3,4,5,6].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'Huésped' : 'Huéspedes'}</option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-1 flex items-end">
                <Button 
                  className="w-full h-10"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => {
                    window.location.href = `/espacios?checkin=${checkin}&checkout=${checkout}&guests=${guests}`
                  }}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}
