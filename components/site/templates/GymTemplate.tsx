'use client'

import { SiteHeader } from '../SiteHeader'
import { SiteFooter } from '../SiteFooter'
import { HeroGym, MembershipPlans, ClassesSchedule, Trainers } from '../sections/gym'
import { ContactSection } from '../sections/ContactSection'
import type { OrganizationWithDetails } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface MembershipPlan {
  id: number
  name: string
  description?: string
  price: number
  duration_days: number
  frequency?: string
  access_rules?: Record<string, any>
}

interface GymTemplateProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  products?: any[]
  membershipPlans?: MembershipPlan[]
  gymClasses?: any[]
  reservationCounts?: Record<number, number>
}

export function GymTemplate({ 
  organization, 
  template, 
  primaryColor, 
  membershipPlans,
  gymClasses,
  reservationCounts
}: GymTemplateProps) {
  const settings = organization.website_settings as any
  
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader 
        organization={organization} 
        primaryColor={primaryColor} 
        template={template}
        showCart={false}
      />
      
      <main>
        {/* Hero Gym */}
        <HeroGym 
          organizationName={organization.name}
          tagline={settings?.hero_subtitle || undefined}
          primaryColor={primaryColor}
          backgroundImage={settings?.hero_image || undefined}
        />
        
        {/* Membership Plans */}
        <MembershipPlans 
          plans={membershipPlans}
          primaryColor={primaryColor}
        />
        
        {/* Classes Schedule */}
        <ClassesSchedule 
          classes={gymClasses}
          reservationCounts={reservationCounts}
          primaryColor={primaryColor}
        />
        
        {/* Trainers */}
        <Trainers primaryColor={primaryColor} />
        
        {/* Contact */}
        <ContactSection 
          organization={organization}
          primaryColor={primaryColor}
          settings={settings}
        />
      </main>
      
      <SiteFooter 
        organization={organization} 
        settings={settings} 
        primaryColor={primaryColor}
        template={template}
      />
    </div>
  )
}
