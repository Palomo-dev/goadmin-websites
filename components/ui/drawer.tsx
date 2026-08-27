'use client'

import * as React from 'react'
import { Drawer as VaulDrawer } from 'vaul'

const Drawer = VaulDrawer.Root
const DrawerTrigger = VaulDrawer.Trigger

const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Content>
>(({ className, children, ...props }, ref) => (
  <VaulDrawer.Portal>
    <VaulDrawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
    <VaulDrawer.Content
      ref={ref}
      className={`fixed z-50 flex h-full w-full max-w-[400px] flex-col bg-white dark:bg-gray-900 shadow-2xl outline-none ${className ?? ''}`}
      {...props}
    >
      {children}
    </VaulDrawer.Content>
  </VaulDrawer.Portal>
))
DrawerContent.displayName = 'DrawerContent'

const DrawerHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 ${className ?? ''}`}
    {...props}
  >
    {children}
  </div>
)
DrawerHeader.displayName = 'DrawerHeader'

const DrawerTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Title>
>(({ className, children, ...props }, ref) => (
  <VaulDrawer.Title
    ref={ref}
    className={`font-semibold text-sm text-gray-900 dark:text-white ${className ?? ''}`}
    {...props}
  >
    {children}
  </VaulDrawer.Title>
))
DrawerTitle.displayName = 'DrawerTitle'

const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Description>
>(({ className, children, ...props }, ref) => (
  <VaulDrawer.Description
    ref={ref}
    className={`text-sm text-gray-500 dark:text-gray-400 ${className ?? ''}`}
    {...props}
  >
    {children}
  </VaulDrawer.Description>
))
DrawerDescription.displayName = 'DrawerDescription'

const DrawerClose = VaulDrawer.Close

export {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
}
