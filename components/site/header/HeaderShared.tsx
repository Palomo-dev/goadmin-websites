'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Search as SearchLarge, ScanSearch, ShoppingBag, ShoppingCart, Package, Gift, User, UserCircle, UserRound, CircleUser, Phone, Mail, ChevronDown, ChevronLeft, ChevronRight, Menu as MenuIcon, LogOut, Globe, Coins, Wallet, Banknote, DollarSign, X } from 'lucide-react';
import type { OrganizationWithDetails, WebsitePageWithChildren } from '@/types/database';
import { ProductSearch } from '../ProductSearch';
import { SearchBarInput } from '../SearchBarInput';
import { CartIndicator } from '../CartIndicator';
import { CurrencySelector } from '../CurrencySelector';
import { useCurrency } from '../CurrencyProvider';
import { createClient } from '@/lib/supabase/client';
import NavDropdown from './NavDropdown';
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext';
import { useTemaColores } from '../TemaColoresContext';
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento';
import { useEncabezadoPie } from '../EncabezadoPieContext';
import { esEnlaceExterno, hrefBoton } from '@/lib/website/encabezadoPie';
import { useTopbarExtras } from './TopbarExtras';

// ============================================================
// SHARED TYPES
// ============================================================

export interface HeaderVariantProps {
  organization: OrganizationWithDetails;
  primaryColor: string;
  navTree: WebsitePageWithChildren[];
  settings: OrganizationWithDetails['website_settings'];
  showCart?: boolean;
  onCartClick?: () => void;
  menuCategories?: MenuCategory[];
  megaMenuItems?: NavItem[];
  branchId?: number | null;
}

export interface MenuCategory {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  image_url: string | null;
  children: MenuCategory[];
}

export interface NavItem {
  name: string;
  href: string;
  children?: NavItem[];
  icon?: string | null;
  badge?: string | null;
}

// ============================================================
// HELPERS
// ============================================================

// Fase 12B: Helper para mapear nombres de iconos a componentes Lucide
const ICON_MAP: Record<string, any> = {
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'package': Package,
  'gift': Gift,
  'search': Search,
  'search-lg': SearchLarge,
  'scan-search': ScanSearch,
  'user': User,
  'user-circle': UserCircle,
  'user-round': UserRound,
  'circle-user': CircleUser,
  'globe': Globe,
  'coins': Coins,
  'wallet': Wallet,
  'banknote': Banknote,
  'dollar-sign': DollarSign,
};

export function getLucideIcon(name: string | null | undefined, fallback: any): any {
  if (!name) return fallback;
  return ICON_MAP[name] ?? fallback;
}

export function pageToNavItem(page: WebsitePageWithChildren): NavItem {
  return {
    name: page.title,
    href: page.slug === 'home' ? '/' : `/${page.slug}`,
    children: page.children.length > 0 ? page.children.map(pageToNavItem) : undefined,
    icon: page.menu_icon,
    badge: page.menu_badge,
  };
}

export function buildNavItems(navTree: WebsitePageWithChildren[]): NavItem[] {
  return navTree.map(pageToNavItem);
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

// Helper: genera el style inline para la opacidad del header
// Soporta dark mode via variables CSS aplicadas con clases Tailwind.
// Si header_bg_color está configurado, usa ese color (con opacidad) en ambos modos;
// si no, usa blanco (light) / gray-900 (dark) con opacidad via CSS vars.
export function headerBgStyle(settings: HeaderVariantProps['settings'] | undefined): React.CSSProperties {
  const opacity = settings?.header_opacity ?? 95;
  const bgColor = settings?.header_bg_color ?? null;
  if (bgColor) {
    // Color personalizado: aplica opacidad sobre el color configurado en ambos modos
    const normalized = bgColor.replace('#', '');
    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity / 100})`,
      };
    }
  }
  // Sin color personalizado: usar variables CSS para que Tailwind dark: funcione
  return {
    ['--header-bg-light' as string]: `rgba(255, 255, 255, ${opacity / 100})`,
    ['--header-bg-dark' as string]: `rgba(17, 24, 39, ${opacity / 100})`,
  };
}

// Helper: style del topbar (usa topbar_bg_color o hereda del header)
export function topbarBgStyle(settings: HeaderVariantProps['settings'] | undefined): React.CSSProperties {
  const bgColor = settings?.topbar_bg_color ?? settings?.header_bg_color ?? null;
  if (bgColor) {
    return { backgroundColor: bgColor };
  }
  // Sin color configurado: herencia del header via variables CSS
  const opacity = settings?.header_opacity ?? 95;
  return {
    ['--header-bg-light' as string]: `rgba(255, 255, 255, ${opacity / 100})`,
    ['--header-bg-dark' as string]: `rgba(17, 24, 39, ${opacity / 100})`,
  };
}

// Helper: style de la barra de menú inferior (nav row)
export function navBgStyle(settings: HeaderVariantProps['settings'] | undefined): React.CSSProperties {
  const bgColor = settings?.nav_bg_color ?? settings?.header_bg_color ?? null;
  if (bgColor) {
    return { backgroundColor: bgColor };
  }
  // Sin color personalizado: variables CSS para dark/light
  const opacity = settings?.header_opacity ?? 95;
  return {
    ['--header-bg-light' as string]: `rgba(255, 255, 255, ${opacity / 100})`,
    ['--header-bg-dark' as string]: `rgba(17, 24, 39, ${opacity / 100})`
  };
}

// Helper: color de texto automático según luminancia del fondo
export function headerTextColor(settings: HeaderVariantProps['settings'] | undefined): string {
  const bgColor = settings?.header_bg_color ?? null;
  if (!bgColor) return ''; // vacío = hereda de Tailwind (gray-700/300)
  const normalized = bgColor.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.5 ? '#111827' : '#ffffff';
}

// Helper: color de texto del topbar
export function topbarTextColor(settings: HeaderVariantProps['settings'] | undefined): string {
  const bgColor = settings?.topbar_bg_color ?? settings?.header_bg_color ?? null;
  if (!bgColor) return '';
  const normalized = bgColor.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.5 ? '#111827' : '#ffffff';
}

// Helper: color de texto de la barra de menú
export function navTextColor(settings: HeaderVariantProps['settings'] | undefined): string {
  const bgColor = settings?.nav_bg_color ?? settings?.header_bg_color ?? null;
  if (!bgColor) return '';
  const normalized = bgColor.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.5 ? '#111827' : '#ffffff';
}

// Helper: color de acento efectivo (accent_color o primaryColor como fallback)
export function accentColor(settings: HeaderVariantProps['settings'] | undefined, primaryColor: string): string {
  return settings?.accent_color || primaryColor;
}

export function HeaderLogo({
  organization,
  primaryColor,
  height = 48,
}: {
  organization: OrganizationWithDetails;
  primaryColor: string;
  height?: number;
}) {
  // Sitio de una sede por prefijo de ruta: el logo lleva a la portada de la sede.
  const { ruta } = useRutaSitio();
  const inicio = ruta('/');
  if (organization.logo_url) {
    return (
      <Link href={inicio} className="flex-shrink-0 flex items-center space-x-3">
        <Image
          src={organization.logo_url}
          alt={organization.name}
          width={height * 3}
          height={height}
          className="w-auto object-contain"
          style={{ height: `${height}px` }}
          priority
        />
      </Link>
    );
  }

  const logoSize = Math.max(40, Math.min(56, height * 0.8));

  return (
    <Link href={inicio} className="flex-shrink-0 flex items-center space-x-3">
      <div
        className="rounded-xl flex items-center justify-center text-white font-bold text-lg"
        style={{ backgroundColor: primaryColor, width: logoSize, height: logoSize }}
      >
        {organization.name.substring(0, 2).toUpperCase()}
      </div>
      <span className="text-xl font-bold text-gray-900 dark:text-white hidden sm:block">
        {organization.name}
      </span>
    </Link>
  );
}

export function HeaderActions({
  settings,
  showCart,
  onCartClick,
  searchStyle,
  organizationId,
  primaryColor,
  showSearchIcon = true,
  organizationSubdomain,
  isMobile = false,
  hideCurrency = false,
  hideAuth = false,
  branchId,
}: {
  settings: HeaderVariantProps['settings'];
  showCart?: boolean;
  onCartClick?: () => void;
  searchStyle?: string;
  organizationId: number;
  primaryColor: string;
  showSearchIcon?: boolean;
  organizationSubdomain?: string;
  isMobile?: boolean;
  hideCurrency?: boolean;
  hideAuth?: boolean;
  branchId?: number | null;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Defaults: true (igual que el header original)
  const showHeaderCart = settings?.show_header_cart !== false && showCart;
  const showHeaderAuth = settings?.show_header_auth !== false;
  const cartBehavior: 'drawer' | 'redirect' = (settings as any)?.cart_click_behavior === 'redirect' ? 'redirect' : 'drawer';

  // Fase 12B: Iconos personalizables
  const CartIconComp = getLucideIcon(settings?.cart_icon as string, ShoppingBag);
  const AuthIconComp = getLucideIcon(settings?.auth_icon as string, User);
  const AuthLoggedInIconComp = getLucideIcon(settings?.auth_icon as string, UserCircle);
  const CurrencyIconComp = getLucideIcon(settings?.currency_icon as string, Globe);
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);

  // Fase 12B: Orden de acciones configurable
  const actionsOrder: string[] = (() => {
    const raw = settings?.actions_order;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { /* fallthrough */ }
    }
    if (Array.isArray(raw)) return raw as string[];
    return ['search', 'currency', 'cart', 'auth'];
  })();

  // Construir elementos de acción según el orden
  const actionElements: Record<string, React.ReactNode | null> = {
    search: showSearchIcon && searchStyle === 'icon' ? (
      <ProductSearch key="search" primaryColor={primaryColor} icon={SearchIconComp} />
    ) : null,
    currency: !isMobile && !hideCurrency ? (
      <CurrencySelector key="currency" primaryColor={primaryColor} icon={CurrencyIconComp} />
    ) : null,
    cart: showHeaderCart ? (
      <CartIndicator
        key="cart"
        primaryColor={primaryColor}
        cartBehavior={cartBehavior}
        onClick={onCartClick}
        organizationSubdomain={organizationSubdomain || ''}
        icon={CartIconComp}
        branchId={branchId}
      />
    ) : null,
    auth: !isMobile && showHeaderAuth && !hideAuth ? (
      isLoggedIn ? (
        <Link key="auth" href="/mi-cuenta" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Mi Cuenta">
          <AuthLoggedInIconComp className="h-6 w-6" style={{ color: primaryColor }} />
        </Link>
      ) : (
        <Link key="auth" href="/auth" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <AuthIconComp className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        </Link>
      )
    ) : null,
  };

  return (
    <div className="flex items-center space-x-4 flex-shrink-0">
      {actionsOrder.map((action) => actionElements[action]).filter(Boolean)}
    </div>
  );
}

export function HeaderCTA({
  text,
  href,
  primaryColor,
  settings,
}: {
  text: string;
  href?: string;
  primaryColor: string;
  settings?: HeaderVariantProps['settings'];
}) {
  const temaColores = useTemaColores();
  const { extras } = useEncabezadoPie();
  if (!text) return null;
  // Destinos especiales del contrato: `whatsapp` (número del sitio) y `maps` (Cómo llegar de la
  // sede). Sin ese dato el botón no se pinta. Cualquier otro enlace, igual que siempre.
  const especial = href === 'whatsapp' || href === 'maps';
  const resuelto = especial ? hrefBoton(href, extras.enlaces) : href || '#';
  if (!resuelto) return null;
  const linkHref = resuelto;
  const externo = especial && esEnlaceExterno(resuelto);

  // Fase 12C: Estilos personalizados del CTA desde settings
  const paddingX = settings?.cta_padding_x ?? 16;
  const paddingY = settings?.cta_padding_y ?? 8;
  const borderRadius = settings?.cta_border_radius ?? 8;
  const borderWidth = settings?.cta_border_width ?? 0;
  const borderColor = settings?.cta_border_color ?? 'transparent';
  const fullWidth = settings?.cta_full_width ?? false;
  const shadow = settings?.cta_shadow ?? 'none';
  const bgColor = settings?.cta_bg_color ?? primaryColor;
  // Sitio V2 con tema: negro o blanco según el contraste con el fondo del botón (misma regla que
  // el ERP, textoSobreAcento); con acentos claros (#C8A97E, #D4AF37…) el blanco no se leía.
  // Un cta_text_color elegido a mano sigue mandando; legacy, blanco como siempre.
  const textColor = settings?.cta_text_color
    ?? (temaColores ? textoSobreAcentoSiHex(bgColor) ?? '#ffffff' : '#ffffff');
  const marginTop = settings?.cta_margin_top ?? 0;
  const marginBottom = settings?.cta_margin_bottom ?? 0;

  const shadowMap: Record<string, string> = {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.1)',
    md: '0 4px 6px rgba(0,0,0,0.15)',
    lg: '0 10px 15px rgba(0,0,0,0.2)',
  };

  const className = fullWidth
    ? 'flex items-center justify-center text-sm font-semibold transition-opacity hover:opacity-90'
    : 'hidden md:inline-flex items-center text-sm font-semibold transition-opacity hover:opacity-90';

  return (
    <Link
      href={linkHref}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={className}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: `${paddingY}px ${paddingX}px`,
        borderRadius: `${borderRadius}px`,
        borderWidth: `${borderWidth}px`,
        borderColor,
        borderStyle: 'solid',
        boxShadow: shadowMap[shadow] ?? 'none',
        marginTop: `${marginTop}px`,
        marginBottom: `${marginBottom}px`,
        ...(fullWidth ? { width: '100%' } : {}),
      }}
    >
      {text}
    </Link>
  );
}

/**
 * Segundo botón del encabezado (`header_cta2_text` / `header_cta2_url`), en contorno, antes del
 * principal (láminas de Figma «16 Sitio web»). Mismo tamaño y redondeo que el principal
 * (cta_padding_*, cta_border_radius). Sin texto o sin enlace (lo de hoy) no pinta nada.
 */
export function HeaderCTA2({ settings }: { settings?: HeaderVariantProps['settings'] }) {
  const { opciones, extras } = useEncabezadoPie();
  const boton = opciones.boton2;
  if (!boton) return null;
  const href = hrefBoton(boton.url, extras.enlaces);
  if (!href) return null;
  const paddingX = settings?.cta_padding_x ?? 16;
  const paddingY = settings?.cta_padding_y ?? 8;
  const borderRadius = settings?.cta_border_radius ?? 8;
  const externo = esEnlaceExterno(href) || href.startsWith('tel:') || href.startsWith('mailto:');
  const estilo: React.CSSProperties = {
    padding: `${Math.max(0, paddingY - 1)}px ${Math.max(0, paddingX - 1)}px`,
    borderRadius: `${borderRadius}px`,
  };
  const clase = 'hidden md:inline-flex items-center whitespace-nowrap border border-current text-sm font-semibold text-gray-900 dark:text-white transition-opacity hover:opacity-80';
  return externo ? (
    <a href={href} className={clase} style={estilo} data-boton-secundario="" {...(esEnlaceExterno(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {boton.texto}
    </a>
  ) : (
    <Link href={href} className={clase} style={estilo} data-boton-secundario="">
      {boton.texto}
    </Link>
  );
}

export function HeaderTopbar({
  organization,
  settings,
  forceVisible = false,
}: {
  organization: OrganizationWithDetails;
  settings?: HeaderVariantProps['settings'];
  forceVisible?: boolean;
}) {
  const phone = organization.phone || '';
  const email = organization.email || '';
  const showEmail = settings?.topbar_show_email !== false;
  const showPhone = settings?.topbar_show_phone !== false;
  const announcementRaw = settings?.topbar_announcement ?? '';
  const contactPosition = settings?.topbar_contact_position ?? 'left';

  // Parsear mensajes: soporta JSON array (nuevo) o string simple (compatibilidad)
  let announcements: string[] = [];
  if (announcementRaw) {
    try {
      const parsed = JSON.parse(announcementRaw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        announcements = parsed.filter((s) => s.trim() !== '');
      } else {
        announcements = [announcementRaw];
      }
    } catch {
      announcements = [announcementRaw];
    }
  }

  // Carrusel de mensajes: auto-rotate cada 6s, con flechas
  const [currentIdx, setCurrentIdx] = useState(0);
  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % announcements.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  // Color del topbar: configurado o default (gray-900)
  const bgColor = settings?.topbar_bg_color ?? settings?.header_bg_color ?? null;
  const bgStyle: React.CSSProperties = bgColor
    ? { backgroundColor: bgColor }
    : {};
  const textColor = bgColor ? topbarTextColor(settings) : '';
  const textClass = bgColor ? '' : 'text-white';
  const textStyle = textColor ? { color: textColor } : undefined;
  // Sede y estado, envío gratis, cupos e idioma (TopbarExtras). Vacío con las opciones en su
  // default: entonces la barra se pinta exactamente como antes (ramas de abajo).
  const nuevos = useTopbarExtras(textStyle);
  const hayNuevos = nuevos.izquierda.length > 0 || nuevos.idioma !== null;

  // Componente de contacto (email + teléfono)
  // En móvil (forceVisible) el email se muestra; en desktop solo en lg+
  const contactBlock = (
    <div className="flex items-center gap-4 flex-shrink-0">
      {showPhone && phone && (
        <span className="flex items-center gap-1" style={textStyle}>
          <Phone className="h-3 w-3" />
          {phone}
        </span>
      )}
      {showEmail && email && (
        <span className={`${forceVisible ? 'flex' : 'hidden lg:flex'} items-center gap-1`} style={textStyle}>
          <Mail className="h-3 w-3" />
          {email}
        </span>
      )}
    </div>
  );

  // Componente de mensajes promocionales (carrusel con flechas)
  const announcementsBlock = announcements.length > 0 && (
    <div className="flex-1 flex items-center justify-center gap-2 mx-4 overflow-hidden">
      {announcements.length > 1 && (
        <button
          onClick={() => setCurrentIdx((prev) => (prev - 1 + announcements.length) % announcements.length)}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          style={textStyle}
          aria-label="Mensaje anterior"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
      )}

      <div className="flex-1 text-center truncate" style={textStyle}>
        {announcements[currentIdx]}
      </div>

      {announcements.length > 1 && (
        <button
          onClick={() => setCurrentIdx((prev) => (prev + 1) % announcements.length)}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          style={textStyle}
          aria-label="Mensaje siguiente"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  // Con lo nuevo: sede/estado, envío o cupos a la izquierda; anuncios al centro; contacto e
  // idioma a la derecha (láminas de Figma). En móvil, lo nuevo va en una fila propia arriba.
  if (hayNuevos && forceVisible) {
    return (
      <div
        className={`block text-xs py-1.5 px-4 ${bgColor ? '' : 'bg-gray-900 dark:bg-black'} ${textClass}`}
        style={bgStyle}
        data-topbar-extras=""
      >
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{nuevos.izquierda}{nuevos.idioma}</div>
          {announcements.length > 0 && (
            <div className="text-center truncate" style={textStyle}>
              {announcements[currentIdx]}
            </div>
          )}
        </div>
      </div>
    );
  }
  // Sin contacto ni anuncios (p. ej. solo «Envío gratis»), centrado como la franja de anuncio.
  const soloNuevos = !(showPhone && phone) && !(showEmail && email) && announcements.length === 0 && !nuevos.idioma;
  if (hayNuevos) {
    return (
      <div
        className={`hidden md:block text-xs py-1.5 px-4 ${bgColor ? '' : 'bg-gray-900 dark:bg-black'} ${textClass}`}
        style={bgStyle}
        data-topbar-extras=""
      >
        <div className={`max-w-7xl mx-auto flex items-center gap-4 overflow-hidden ${soloNuevos ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-5 flex-shrink-0">{nuevos.izquierda}</div>
          {announcementsBlock || (soloNuevos ? null : <div className="flex-1" />)}
          <div className="flex items-center gap-4 flex-shrink-0">
            {contactBlock}
            {nuevos.idioma}
          </div>
        </div>
      </div>
    );
  }

  // En móvil: layout vertical por falta de espacio horizontal.
  // contactPosition controla la alineación del bloque de contacto.
  if (forceVisible) {
    const contactAlign = contactPosition === 'right' ? 'justify-end' : 'justify-start';
    return (
      <div
        className={`block text-xs py-1.5 px-4 ${bgColor ? '' : 'bg-gray-900 dark:bg-black'} ${textClass}`}
        style={bgStyle}
      >
        <div className="flex flex-col gap-1">
          {/* Anuncios arriba si contacto va a la derecha; contacto arriba si va a la izquierda */}
          {contactPosition === 'right' && announcements.length > 0 && (
            <div className="text-center truncate" style={textStyle}>
              {announcements[currentIdx]}
            </div>
          )}

          {/* Contacto alineado según contactPosition */}
          {contactBlock && (
            <div className={`flex ${contactAlign}`}>
              {contactBlock}
            </div>
          )}

          {/* Anuncios abajo si contacto va a la izquierda */}
          {contactPosition === 'left' && announcements.length > 0 && (
            <div className="text-center truncate" style={textStyle}>
              {announcements[currentIdx]}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: layout horizontal original
  // Si no hay anuncios, usar justify-end cuando contacto va a la derecha
  const hasAnnouncements = announcements.length > 0;
  const desktopJustify = !hasAnnouncements && contactPosition === 'right' ? 'justify-end' : 'justify-between';

  return (
    <div
      className={`hidden md:block text-xs py-1.5 px-4 ${bgColor ? '' : 'bg-gray-900 dark:bg-black'} ${textClass}`}
      style={bgStyle}
    >
      <div className={`max-w-7xl mx-auto flex items-center ${desktopJustify} gap-4 overflow-hidden`}>
        {/* Izquierda */}
        {contactPosition === 'left' ? contactBlock : announcementsBlock}

        {/* Derecha */}
        {contactPosition === 'left' ? announcementsBlock : contactBlock}
      </div>
    </div>
  );
}

export function NavLink({
  item,
  primaryColor,
  hasDropdown = false,
}: {
  item: NavItem;
  primaryColor: string;
  hasDropdown?: boolean;
}) {
  const showDropdown = hasDropdown && item.children && item.children.length > 0;

  if (!showDropdown) {
    return (
      <Link
        href={item.href}
        className="relative text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors whitespace-nowrap flex items-center gap-1"
        style={{ '--hover-color': primaryColor } as React.CSSProperties}
      >
        {item.icon && <span className="text-base">{item.icon}</span>}
        <span>{item.name}</span>
        {item.badge && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
            style={{ backgroundColor: primaryColor }}
          >
            {item.badge}
          </span>
        )}
        {hasDropdown && <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
      </Link>
    );
  }

  // Item con children → renderizar con NavDropdown al hover
  return <NavDropdown item={item} primaryColor={primaryColor} />;
}

export function NavList({
  items,
  primaryColor,
  className = '',
}: {
  items: NavItem[];
  primaryColor: string;
  className?: string;
}) {
  return (
    <nav className={`flex items-center gap-5 ${className}`}>
      {items.map((item, i) => (
        <NavLink
          key={i}
          item={item}
          primaryColor={primaryColor}
          hasDropdown={!!item.children}
        />
      ))}
    </nav>
  );
}

export function SearchBarInline({
  primaryColor,
  className = '',
  size = 'md',
  icon,
}: {
  primaryColor: string;
  /** Ya no se usa: el buscador resuelve la organización por el host. Se acepta por compatibilidad. */
  organizationId?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: any;
}) {
  return (
    <div className={className}>
      <SearchBarInput
        primaryColor={primaryColor}
        size={size}
        className="w-full"
        icon={icon}
      />
    </div>
  );
}

export function MobileMenuButton({
  onClick,
  className = '',
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`md:hidden p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white ${className}`}
      aria-label="Abrir menú"
    >
      <MenuIcon className="h-6 w-6" />
    </button>
  );
}

// ============================================================
// MOBILE SHARED COMPONENTS
// ============================================================

// Selector de moneda móvil con chips (restaurado del header original)
export function MobileCurrencyChips({ primaryColor }: { primaryColor?: string }) {
  const { currency, availableCurrencies, setCurrency, loading } = useCurrency();
  const [open, setOpen] = useState(false);

  if (loading || availableCurrencies.length <= 1) return null;

  const current = availableCurrencies.find((c) => c.code === currency);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-400" />
          {current ? `${current.code} — ${current.country}` : currency}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-gray-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Seleccionar moneda</h3>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {availableCurrencies.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setCurrency(c.code);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    c.code === currency
                      ? 'font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  style={c.code === currency && primaryColor ? { color: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}
                >
                  <span>{c.code}</span>
                  <span className="text-xs text-gray-400">{c.country}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Sección de auth para drawers móviles (login/registro/logout)
export function MobileAuthSection({
  isLoggedIn,
  primaryColor,
  onNavigate,
}: {
  isLoggedIn: boolean;
  primaryColor: string;
  onNavigate: () => void;
}) {
  if (!isLoggedIn) {
    return (
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
        <Link
          href="/auth"
          className="block w-full text-center px-4 py-2.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
          onClick={onNavigate}
        >
          Iniciar sesión
        </Link>
        <Link
          href="/auth?tab=register"
          className="block w-full text-center px-4 py-2.5 rounded-lg font-medium border transition-colors"
          style={{ borderColor: primaryColor, color: primaryColor }}
          onClick={onNavigate}
        >
          Registrarse
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
      <Link
        href="/mi-cuenta"
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
        onClick={onNavigate}
      >
        <UserCircle className="h-5 w-5" style={{ color: primaryColor }} />
        Mi Cuenta
      </Link>
      <button
        onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          onNavigate();
          window.location.href = '/';
        }}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </button>
    </div>
  );
}

// Hook para auth state en componentes móviles
export function useAuthState() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] getSession:', !!session, session?.user?.email);
      setIsLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] onAuthStateChange:', _event, !!session);
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return isLoggedIn;
}
