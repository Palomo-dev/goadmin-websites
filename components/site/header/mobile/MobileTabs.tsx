'use client';

import { FilaSedeMovil } from '../SelectorSedeEncabezado';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, LayoutGrid, Search, ShoppingBag, ShoppingCart, User, X } from 'lucide-react';
import { ProductSearch } from '../../ProductSearch';
import { contarUnidadesCarrito } from '@/lib/cart';
import { estiloIconosEncabezado } from '@/lib/website/encabezadoEstilo';
import { IconoConCirculo, propsTrazoIcono } from '../IconoEncabezado';
import {
  HeaderLogo,
  HeaderActions,
  HeaderTopbar,
  SearchBarInline,
  buildNavItems,
  BloqueMonedaMovil,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  CLASE_FONDO_ENCABEZADO,
  variablesEncabezado,
  estiloBarraEncabezado,
  marcaFondoEncabezado,
} from '../HeaderShared';
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext';
import { FilaLogoMovil } from './FilaLogoMovil';

/**
 * MobileTabs
 * Header móvil con barra inferior fija tipo app.
 * - Header: logo izq + acciones der (sin menu button)
 * - Barra inferior fija (fixed bottom-0) con 5 tabs:
 *   Inicio, Categorías (modal), Buscar (el mismo panel del encabezado), Carrito, Cuenta
 */
export default function MobileTabs({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
  posicionLogo,
  menuCategories,
  branchId,
}: HeaderVariantProps) {
  const [showCategories, setShowCategories] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const navItems = buildNavItems(navTree);
  const { ruta } = useRutaSitio();
  const organizationId = organization.id;
  const searchStyle = settings?.mobile_search_style ?? 'icon';
  const unidadesCarrito = useUnidadesCarrito(organization.subdomain || '', branchId);

  // Fase 12B: Iconos personalizables para la barra inferior. Bolsa/carrito y relleno
  // siguen el mismo ajuste del encabezado (header_cart_glyph, header_icons_weight).
  const estiloIconos = estiloIconosEncabezado(settings);
  const trazo = propsTrazoIcono(estiloIconos.relleno);
  const SearchTabIcon = getLucideIcon(settings?.search_icon as string, Search);
  const CartTabIcon =
    estiloIconos.forma === 'carrito'
      ? ShoppingCart
      : estiloIconos.forma === 'bolsa'
        ? ShoppingBag
        : getLucideIcon(settings?.cart_icon as string, ShoppingBag);
  const AuthTabIcon = getLucideIcon(settings?.auth_icon as string, User);
  const iconoTab = (Icono: typeof ShoppingBag) => (
    <IconoConCirculo circulo={estiloIconos.circulo} primaryColor={primaryColor} tamano="sm">
      <Icono className="h-5 w-5" {...trazo} />
    </IconoConCirculo>
  );

  return (
    <header className="md:hidden sticky top-0 z-40 w-full" style={variablesEncabezado(settings)}>
      {settings?.mobile_show_topbar && <HeaderTopbar organization={organization} settings={settings} forceVisible />}

      <div className={CLASE_FONDO_ENCABEZADO} style={estiloBarraEncabezado(settings, 'bottom')} {...marcaFondoEncabezado(settings)}>
        <div className="px-4">
          <FilaLogoMovil
            ajustes={settings}
            posicion={posicionLogo}
            minHeight={Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16)}
            logo={<HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))} />}
            acciones={
              <HeaderActions
                settings={settings}
                showCart={showCart}
                onCartClick={onCartClick}
                searchStyle={searchStyle}
                organizationId={organizationId}
                primaryColor={primaryColor}
                organizationSubdomain={organization.subdomain || ''}
                showSearchIcon={searchStyle === 'icon'}
                isMobile={true}
                branchId={branchId}
              />
            }
          />

          {searchStyle === 'bar' && (
            <div className="pb-3">
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="w-full"
                size="sm"
                icon={SearchTabIcon}
              />
            </div>
          )}
        </div>
      </div>

      {/* Espaciador para la barra inferior fija */}
      <div className="h-14" aria-hidden="true" />

      {/* Barra inferior fija */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 ${CLASE_FONDO_ENCABEZADO}`} style={estiloBarraEncabezado(settings, 'top')} {...marcaFondoEncabezado(settings)}>
        <div className="grid grid-cols-5 h-14">
          <TabButton href={ruta('/')} icon={<Home className="h-5 w-5" />} label="Inicio" />
          <TabButton
            onClick={() => setShowCategories(true)}
            icon={<LayoutGrid className="h-5 w-5" />}
            label="Categorías"
          />
          <TabButton
            onClick={() => setShowSearch(true)}
            icon={<SearchTabIcon className="h-5 w-5" />}
            label="Buscar"
          />
          <TabButton
            onClick={() => onCartClick?.()}
            icon={
              <span className="relative">
                {iconoTab(CartTabIcon)}
                {unidadesCarrito > 0 && (
                  <span
                    className="absolute -top-2 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] leading-4 font-bold text-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {unidadesCarrito > 99 ? '99+' : unidadesCarrito}
                  </span>
                )}
              </span>
            }
            label="Carrito"
            ariaLabel={unidadesCarrito > 0 ? `Carrito, ${unidadesCarrito}` : 'Carrito'}
          />
          <TabButton href="/auth" icon={iconoTab(AuthTabIcon)} label="Cuenta" />
        </div>
      </nav>

      {/* Modal de categorías */}
      {showCategories && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCategories(false)}
            aria-hidden="true"
          />
          <div className={`relative w-full sm:max-w-md ${CLASE_FONDO_ENCABEZADO} rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto`} style={estiloBarraEncabezado(settings)} {...marcaFondoEncabezado(settings)}>
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Categorías</h3>
              <button
                onClick={() => setShowCategories(false)}
                aria-label="Cerrar"
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-[var(--header-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {menuCategories && menuCategories.length > 0
                ? menuCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={ruta(`/categorias/${cat.slug}`)}
                      className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-[var(--header-hover)]"
                      onClick={() => setShowCategories(false)}
                    >
                      {cat.icon && <span className="text-xl">{cat.icon}</span>}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {cat.name}
                      </span>
                    </Link>
                  ))
                : navItems.map((item, i) => (
                    <CategoryNavItem
                      key={i}
                      item={item}
                      primaryColor={primaryColor}
                      onNavigate={() => setShowCategories(false)}
                    />
                  ))}
            </div>

            <BloqueMonedaMovil primaryColor={primaryColor} className="px-4 pb-4 pt-3 border-t border-gray-200 dark:border-gray-800" />
          </div>
        </div>
      )}

      {/* El mismo buscador del encabezado: resultados en vivo, no el formulario a /search. */}
      {showSearch && (
        <ProductSearch
          primaryColor={primaryColor}
          icon={SearchTabIcon}
          abierto
          sinDisparador
          pantallaCompleta
          alCerrar={() => setShowSearch(false)}
        />
      )}
      <FilaSedeMovil primaryColor={primaryColor} />
    </header>
  );
}

function useUnidadesCarrito(subdomain: string, branchId?: number | null) {
  const [unidades, setUnidades] = useState(0);

  useEffect(() => {
    const leer = () => {
      const clave = subdomain || window.location.hostname.split('.')[0];
      setUnidades(contarUnidadesCarrito(clave, branchId));
    };
    leer();
    window.addEventListener('cart-updated', leer);
    window.addEventListener('storage', leer);
    return () => {
      window.removeEventListener('cart-updated', leer);
      window.removeEventListener('storage', leer);
    };
  }, [subdomain, branchId]);

  return unidades;
}

function TabButton({
  href,
  onClick,
  icon,
  label,
  ariaLabel,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  ariaLabel?: string;
}) {
  const content = (
    <span className="flex flex-col items-center justify-center gap-0.5 h-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center justify-center">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="flex items-center justify-center" aria-label={ariaLabel || label}>
      {content}
    </button>
  );
}

function CategoryNavItem({
  item,
  primaryColor,
  onNavigate,
}: {
  item: NavItem;
  primaryColor: string;
  onNavigate: () => void;
}) {
  if (item.children && item.children.length > 0) {
    return (
      <details className="group">
        <summary className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-[var(--header-hover)] cursor-pointer list-none">
          {item.icon && <span className="text-xl">{item.icon}</span>}
          <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
            {item.name}
          </span>
          {item.badge && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              {item.badge}
            </span>
          )}
          <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="pl-8 space-y-1">
          {item.children.map((child, j) => (
            <Link
              key={j}
              href={child.href}
              className="block py-2 px-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              onClick={onNavigate}
            >
              {child.name}
            </Link>
          ))}
        </div>
      </details>
    );
  }

  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-[var(--header-hover)]"
      onClick={onNavigate}
    >
      {item.icon && <span className="text-xl">{item.icon}</span>}
      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
        {item.name}
      </span>
      {item.badge && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
          style={{ backgroundColor: primaryColor }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
