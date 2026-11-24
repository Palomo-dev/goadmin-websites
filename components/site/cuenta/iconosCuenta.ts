/**
 * Íconos de los accesos de Mi cuenta (sin emojis). Archivo sin 'use client' para que lo usen las
 * páginas del servidor y los componentes del navegador.
 */
import {
  CalendarClock,
  CalendarDays,
  Car,
  CheckCircle2,
  CircleUser,
  ClipboardList,
  Dumbbell,
  FileText,
  Heart,
  History,
  Home,
  IdCard,
  MapPin,
  Package,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import type { ClaveMenuCuenta } from '@/lib/cuenta/reglasCuenta'

export const ICONOS_CUENTA: Record<ClaveMenuCuenta, LucideIcon> = {
  inicio: Home,
  pedidos: Package,
  direcciones: MapPin,
  favoritos: Heart,
  cupones: Ticket,
  facturas: FileText,
  datos: CircleUser,
  factura: IdCard,
  reservas: CalendarDays,
  citas: CalendarClock,
  cotizaciones: ClipboardList,
  membresia: Dumbbell,
  clases: CalendarDays,
  checkins: CheckCircle2,
  tickets: Ticket,
  pases: Ticket,
  vehiculos: Car,
  historial: History,
}
