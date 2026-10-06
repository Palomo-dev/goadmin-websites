/**
 * JsonLd (FASE 12.5)
 *
 * Genera datos estructurados JSON-LD desde los datos reales de la organización
 * y la página, para inyectarlos en el <head> de las páginas públicas.
 *
 * Tipos soportados:
 *  - Organization (en todas las páginas)
 *  - WebSite (en home)
 *  - BreadcrumbList (en páginas internas)
 *  - Product / ItemList (en páginas de productos/categorías)
 *  - Restaurant / LocalBusiness por sede (SEO local; lo arma lib/seo/sede.ts)
 *
 * El componente renderiza un <script type="application/ld+json"> que Next.js
 * inyecta en el <head> vía el metadata API o directamente.
 */

interface OrganizationData {
  name: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  custom_domain?: string | null;
  subdomain?: string | null;
}

interface PageData {
  slug: string;
  title: string;
  meta_title?: string | null;
  meta_description?: string | null;
}

interface ProductData {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  image_url?: string | null;
  slug?: string | null;
  uuid?: string | null;
}

/**
 * Construye el objeto JSON-LD de tipo Organization.
 */
export function buildOrganizationJsonLd(org: OrganizationData, baseUrl: string) {
  const ld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: baseUrl,
  };

  if (org.description) ld.description = org.description;
  if (org.logo_url) {
    ld.logo = { '@type': 'ImageObject', url: org.logo_url };
    ld.image = org.logo_url;
  }
  if (org.email) ld.email = org.email;
  if (org.phone) ld.phone = org.phone;

  if (org.address || org.city || org.country) {
    ld.address = {
      '@type': 'PostalAddress',
      ...(org.address && { streetAddress: org.address }),
      ...(org.city && { addressLocality: org.city }),
      ...(org.country && { addressCountry: org.country }),
    };
  }

  return ld;
}

/**
 * Construye el objeto JSON-LD de tipo WebSite (para home).
 */
export function buildWebsiteJsonLd(org: OrganizationData, baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: org.name,
    url: baseUrl,
    publisher: { '@type': 'Organization', name: org.name },
  };
}

/**
 * Construye BreadcrumbList para páginas internas.
 */
export function buildBreadcrumbJsonLd(page: PageData, orgName: string, baseUrl: string) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Inicio',
      item: baseUrl,
    },
  ];

  if (page.slug !== 'home') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: page.meta_title || page.title,
      item: `${baseUrl}/${page.slug}`,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/**
 * Construye ItemList de productos para páginas de productos/categorías.
 */
export function buildProductListJsonLd(products: ProductData[], baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      ...(p.uuid && { url: `${baseUrl}/productos/${p.uuid}` }),
      ...(p.image_url && { image: p.image_url }),
    })),
  };
}

interface SedeJsonLd {
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  lat: number | null;
  lng: number | null;
  foto: string | null;
}

export interface EspecificacionHorario {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string;
  opens: string;
  closes: string;
}

/**
 * Restaurant (o LocalBusiness fuera de restaurantes) de UNA sede: dirección, geo,
 * teléfono, horario, carta y reservas. `horario` ya viene en el formato de schema.org
 * (lo calcula lib/seo/sede.ts desde `branches.opening_hours`; vacío si no está revisado).
 */
export function buildRestaurantJsonLd(
  sede: SedeJsonLd,
  url: string,
  opciones: {
    tipo: 'Restaurant' | 'LocalBusiness';
    marca: string;
    horario: EspecificacionHorario[];
    aceptaReservas?: boolean;
    carta?: string | null;
    logo?: string | null;
  },
) {
  const ld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': opciones.tipo,
    name: sede.nombre === opciones.marca ? opciones.marca : `${opciones.marca} · ${sede.nombre}`,
    url,
  };
  if (sede.foto || opciones.logo) ld.image = sede.foto || opciones.logo;
  if (sede.telefono) ld.telephone = sede.telefono;
  if (sede.direccion || sede.ciudad) {
    ld.address = {
      '@type': 'PostalAddress',
      ...(sede.direccion && { streetAddress: sede.direccion }),
      ...(sede.ciudad && { addressLocality: sede.ciudad }),
    };
  }
  if (sede.lat !== null && sede.lng !== null) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: sede.lat, longitude: sede.lng };
  }
  if (opciones.horario.length > 0) ld.openingHoursSpecification = opciones.horario;
  if (opciones.tipo === 'Restaurant') {
    if (opciones.carta) ld.hasMenu = opciones.carta;
    if (typeof opciones.aceptaReservas === 'boolean') ld.acceptsReservations = opciones.aceptaReservas;
  }
  return ld;
}

/**
 * JSON dentro de <script>: `<` se escapa para que un nombre con «</script>» no cierre
 * la etiqueta (los textos vienen de lo que escribe cada organización).
 */
function jsonSeguro(ld: Record<string, any>): string {
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

/**
 * Componente que renderiza uno o varios objetos JSON-LD en un <script>.
 */
export function JsonLd({ data }: { data: Record<string, any> | Record<string, any>[] }) {
  const scripts = Array.isArray(data) ? data : [data];
  return (
    <>
      {scripts.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonSeguro(ld) }}
        />
      ))}
    </>
  );
}
