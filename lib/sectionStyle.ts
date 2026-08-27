/**
 * Helpers de estilo del lado del sitio (F0.5).
 *
 * Traducen el contrato de estilo guardado por el editor (content + settings)
 * a clases Tailwind estáticas + CSS variables inline.
 *
 * Regla crítica: NUNCA se generan clases Tailwind con valores interpolados
 * (p.ej. `rounded-[${n}px]`) porque Tailwind no las genera en build. En su
 * lugar se usan CSS variables inline (`--sec-radius: 12px`) + clases estáticas
 * arbitrarias (`rounded-[var(--sec-radius)]`) escritas como literales en este
 * archivo para que el scanner de Tailwind las detecte.
 *
 * Este archivo es importable desde componentes server y client: sólo usa
 * `import type` para tipos de React y lógica pura. El único acceso al DOM
 * (`window.innerWidth`) está protegido por `typeof window` para SSR.
 */

import type { CSSProperties } from 'react';

/** Breakpoints alineados con tailwind.config.ts (sm=640, md=768, lg=1024). */
const TABLET_MIN = 768;
const DESKTOP_MIN = 1024;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/** Objeto responsivo guardado por el editor cuando `field.responsive = true`. */
export interface ResponsiveValue<T> {
  desktop?: T;
  tablet?: T;
  mobile?: T;
}

/**
 * Detecta el breakpoint activo a partir de `window.innerWidth`.
 * En SSR (sin `window`) devuelve `desktop` para evitar hidratación rota;
 * los componentes client pueden re-renderizar tras mount con el valor real.
 */
export function getBreakpoint(width?: number): Breakpoint {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : DESKTOP_MIN);
  if (w < TABLET_MIN) return 'mobile';
  if (w < DESKTOP_MIN) return 'tablet';
  return 'desktop';
}

/**
 * Resuelve un valor que puede ser escalar, responsivo ({desktop,tablet,mobile})
 * o undefined.
 *
 * - `undefined` → `fallback`
 * - escalar → tal cual
 * - objeto responsivo → valor del breakpoint activo, con cascada
 *   mobile → tablet → desktop (un breakpoint usa el primer ancestro definido).
 */
export function resolveResponsive<T>(
  value: T | ResponsiveValue<T> | undefined,
  fallback: T,
  width?: number,
): T {
  if (value === undefined) return fallback;
  if (value === null) return fallback;
  // Objeto responsivo: tiene al menos una de las tres claves y NO es un escalar
  // con una propiedad casual llamada "desktop". Aceptamos objetos plain.
  if (typeof value === 'object' && !Array.isArray(value)) {
    const r = value as ResponsiveValue<T>;
    const bp = getBreakpoint(width);
    if (bp === 'mobile' && r.mobile !== undefined) return r.mobile as T;
    if (bp === 'tablet' && r.tablet !== undefined) return r.tablet as T;
    if (bp === 'desktop' && r.desktop !== undefined) return r.desktop as T;
    // Cascada: si el breakpoint activo no tiene valor, subir al siguiente.
    if (r.desktop !== undefined) return r.desktop as T;
    if (r.tablet !== undefined) return r.tablet as T;
    if (r.mobile !== undefined) return r.mobile as T;
    return fallback;
  }
  return value as T;
}

// ---------------------------------------------------------------------------
// Mapas a clases Tailwind estáticas (literales para que el scanner las genere)
// ---------------------------------------------------------------------------

const CONTAINER_MAX: Record<string, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1400px]',
  full: 'max-w-none',
};

const SHADOW_CLASS: Record<string, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};

const CARD_SHADOW_CLASS: Record<string, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};

const CARD_SHADOW_HOVER_CLASS: Record<string, string> = {
  none: '',
  sm: 'hover:shadow-sm',
  md: 'hover:shadow-md',
  lg: 'hover:shadow-lg',
  xl: 'hover:shadow-xl',
};

const CARD_HOVER_CLASS: Record<string, string> = {
  none: '',
  zoom: 'transition-transform duration-200 hover:scale-[1.02]',
  lift: 'transition-shadow duration-200 hover:shadow-lg',
  glow: 'transition-shadow duration-200 hover:shadow-xl',
  border: 'transition-colors duration-200 hover:border-2',
};

const CARD_LAYOUT_CLASS: Record<string, string> = {
  vertical: 'flex-col',
  horizontal: 'flex-row',
  overlay: 'flex-col',
};

const IMAGE_FIT_CLASS: Record<string, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
  none: 'object-none',
};

const TEXT_ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

const BUTTON_VARIANT_CLASS: Record<string, string> = {
  solid: 'inline-flex items-center justify-center font-medium',
  outline: 'inline-flex items-center justify-center font-medium border',
  ghost: 'inline-flex items-center justify-center font-medium',
  link: 'inline-flex items-center justify-center underline-offset-4',
};

/** Dirección del degradado → ángulo CSS (deg). */
const GRADIENT_DIR: Record<string, string> = {
  'to-r': '90deg',
  'to-l': '270deg',
  'to-t': '0deg',
  'to-b': '180deg',
  'to-tr': '45deg',
  'to-tl': '315deg',
  'to-br': '135deg',
  'to-bl': '225deg',
};

// ---------------------------------------------------------------------------
// Tipos de entrada (flexibles: el content llega como JSON desde Supabase)
// ---------------------------------------------------------------------------

interface StyleContent {
  [key: string]: unknown;
  bg_type?: string | null;
  bg_color?: string | null;
  bg_gradient_from?: string | null;
  bg_gradient_to?: string | null;
  bg_gradient_dir?: string | null;
  bg_image?: string | null;
  bg_overlay?: number | null;
  text_color?: string | null;
  radius?: number | null;
  shadow?: string | null;
  border_width?: number | null;
  border_color?: string | null;
  full_bleed?: boolean | null;
  container_width?: string | null;
}

interface LegacySettings {
  [key: string]: unknown;
  bg_color?: string | null;
  text_color?: string | null;
}

export interface StyleResult {
  className: string;
  style: CSSProperties;
}

/** Convierte un valor numérico/string a px string seguro. */
function px(n: unknown, fallback = 0): string {
  const num = typeof n === 'number' ? n : typeof n === 'string' ? parseFloat(n) : NaN;
  return Number.isFinite(num) ? `${num}px` : `${fallback}px`;
}

/**
 * Construye el estilo de una sección (contenedor externo).
 *
 * Precedencia de colores:
 *   content.bg_color / content.text_color  >  settings.bg_color / settings.text_color
 *   (formato viejo en settings, para no romper sitios existentes).
 */
export function buildSectionStyle(
  content: StyleContent | null | undefined,
  settings: LegacySettings | null | undefined,
  sectionType?: string,
): StyleResult {
  const c = content ?? {};
  const s = settings ?? {};

  const style: CSSProperties = {};
  const classes: string[] = ['w-full'];

  // --- Fondo ---
  const bgType = (c.bg_type as string) ?? 'none';
  const bgColor = (c.bg_color as string) ?? (s.bg_color as string) ?? null;

  if (bgType === 'color' && bgColor) {
    (style as Record<string, string>)['--sec-bg'] = bgColor;
    classes.push('bg-[var(--sec-bg)]');
  } else if (bgType === 'gradient') {
    const from = (c.bg_gradient_from as string) ?? '#000000';
    const to = (c.bg_gradient_to as string) ?? '#ffffff';
    const dir = GRADIENT_DIR[(c.bg_gradient_dir as string)] ?? '135deg';
    style.backgroundImage = `linear-gradient(${dir}, ${from}, ${to})`;
  } else if (bgType === 'image' && c.bg_image) {
    const overlay = typeof c.bg_overlay === 'number' ? c.bg_overlay : 0;
    if (overlay > 0) {
      const alpha = overlay / 100;
      style.backgroundImage = `linear-gradient(rgba(0,0,0,${alpha}), rgba(0,0,0,${alpha})), url(${c.bg_image})`;
    } else {
      style.backgroundImage = `url(${c.bg_image})`;
    }
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
  } else if (bgColor && bgType !== 'none') {
    // bg_type ausente pero hay color heredado (compat)
    (style as Record<string, string>)['--sec-bg'] = bgColor;
    classes.push('bg-[var(--sec-bg)]');
  }

  // --- Color de texto ---
  const textColor = (c.text_color as string) ?? (s.text_color as string) ?? null;
  if (textColor) {
    (style as Record<string, string>)['--sec-text'] = textColor;
    classes.push('text-[var(--sec-text)]');
  }

  // --- Radio de borde ---
  const radius = typeof c.radius === 'number' ? c.radius : 0;
  if (radius > 0) {
    (style as Record<string, string>)['--sec-radius'] = px(radius);
    classes.push('rounded-[var(--sec-radius)]');
  }

  // --- Sombra ---
  const shadow = (c.shadow as string) ?? 'none';
  const shadowClass = SHADOW_CLASS[shadow] ?? SHADOW_CLASS.none;
  if (shadowClass && shadow !== 'none') classes.push(shadowClass);

  // --- Borde ---
  const borderWidth = typeof c.border_width === 'number' ? c.border_width : 0;
  if (borderWidth > 0) {
    classes.push('border');
    style.borderWidth = px(borderWidth);
    if (c.border_color) style.borderColor = c.border_color as string;
    style.borderStyle = 'solid';
  }

  // --- Ancho del contenedor / full bleed ---
  const isHero = sectionType === 'hero';
  const isFullBleed =
    c.full_bleed === true ||
    (c.full_bleed === undefined && c.container_width === undefined && isHero) ||
    c.container_width === 'full';

  const containerWidth = (c.container_width as string) ?? 'lg';
  if (isFullBleed) {
    classes.push('w-full');
  } else {
    classes.push('mx-auto', CONTAINER_MAX[containerWidth] ?? CONTAINER_MAX.lg);
  }

  return { className: classes.join(' '), style };
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

interface CardContent {
  [key: string]: unknown;
  card_radius?: number | null;
  card_shadow?: string | null;
  card_shadow_hover?: string | null;
  card_border_width?: number | null;
  card_border_color?: string | null;
  card_bg?: string | null;
  card_padding?: number | string | null;
  card_hover?: string | null;
  card_layout?: string | null;
  image_fit?: string | null;
  image_ratio?: string | null;
  text_align?: string | null;
  title_lines?: number | null;
  show_description?: boolean | null;
  price_style?: string | null;
  show_compare_price?: boolean | null;
  currency_position?: string | null;
}

export function buildCardStyle(content: CardContent | null | undefined): StyleResult {
  const c = content ?? {};
  const style: CSSProperties = {};
  const classes: string[] = ['flex', 'overflow-hidden'];

  // --- Radio ---
  const radius = typeof c.card_radius === 'number' ? c.card_radius : 0;
  if (radius > 0) {
    (style as Record<string, string>)['--card-radius'] = px(radius);
    classes.push('rounded-[var(--card-radius)]');
  }

  // --- Sombra ---
  const shadow = (c.card_shadow as string) ?? 'none';
  const shadowClass = CARD_SHADOW_CLASS[shadow] ?? CARD_SHADOW_CLASS.none;
  if (shadowClass && shadow !== 'none') classes.push(shadowClass);

  // --- Sombra al hover ---
  const shadowHover = (c.card_shadow_hover as string) ?? null;
  if (shadowHover && shadowHover !== 'none') {
    const hoverCls = CARD_SHADOW_HOVER_CLASS[shadowHover] ?? '';
    if (hoverCls) classes.push(hoverCls);
  }

  // --- Borde ---
  const borderWidth = typeof c.card_border_width === 'number' ? c.card_border_width : 0;
  if (borderWidth > 0) {
    classes.push('border');
    style.borderWidth = px(borderWidth);
    if (c.card_border_color) style.borderColor = c.card_border_color as string;
    style.borderStyle = 'solid';
  }

  // --- Fondo ---
  if (c.card_bg) {
    (style as Record<string, string>)['--card-bg'] = c.card_bg as string;
    classes.push('bg-[var(--card-bg)]');
  }

  // --- Padding ---
  if (c.card_padding !== undefined && c.card_padding !== null) {
    const pad = typeof c.card_padding === 'number' ? c.card_padding : c.card_padding;
    if (typeof pad === 'number') {
      style.padding = px(pad);
    } else if (typeof pad === 'string') {
      // Acepta tokens tipo 'sm','md','lg' o valores css directos.
      const tokenMap: Record<string, string> = {
        none: '0px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      };
      style.padding = tokenMap[pad] ?? pad;
    }
  }

  // --- Hover ---
  const hover = (c.card_hover as string) ?? 'none';
  const hoverClass = CARD_HOVER_CLASS[hover] ?? '';
  if (hoverClass) classes.push(hoverClass);

  // --- Layout ---
  const layout = (c.card_layout as string) ?? 'vertical';
  classes.push(CARD_LAYOUT_CLASS[layout] ?? CARD_LAYOUT_CLASS.vertical);

  // --- Alineación de texto ---
  const textAlign = (c.text_align as string) ?? 'left';
  classes.push(TEXT_ALIGN_CLASS[textAlign] ?? TEXT_ALIGN_CLASS.left);

  return { className: classes.join(' '), style };
}

/**
 * Devuelve la clase de aspect-ratio para la imagen de la card.
 * Mapa estático para que Tailwind genere las clases.
 */
const IMAGE_RATIO_CLASS: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '3:4': 'aspect-[3/4]',
  '16:9': 'aspect-[16/9]',
};

export function resolveImageRatioClass(ratio: string | null | undefined): string {
  return IMAGE_RATIO_CLASS[ratio ?? '1:1'] ?? IMAGE_RATIO_CLASS['1:1'];
}

/**
 * Devuelve la clase estática de `line-clamp` para el título.
 */
const TITLE_LINES_CLASS: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
};

export function resolveTitleLinesClass(lines: number | null | undefined): string {
  const n = typeof lines === 'number' ? lines : 2;
  return TITLE_LINES_CLASS[n] ?? TITLE_LINES_CLASS[2];
}

// ---------------------------------------------------------------------------
// Badges (F5.3)
// ---------------------------------------------------------------------------

export interface BadgeConfig {
  type?: string | null;
  label?: string | null;
  condition_value?: number | null;
  bg_color?: string | null;
  text_color?: string | null;
  position?: string | null;
  shape?: string | null;
  icon?: string | null;
  size?: string | null;
}

const BADGE_POSITION_CLASS: Record<string, string> = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
};

const BADGE_SHAPE_CLASS: Record<string, string> = {
  pill: 'rounded-full',
  square: 'rounded-none',
  ribbon: 'rounded-l-none',
  corner: 'rounded-none',
};

const BADGE_SIZE_CLASS: Record<string, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export function resolveBadgeClasses(badge: BadgeConfig): string {
  const pos = BADGE_POSITION_CLASS[badge.position ?? 'top-left'] ?? BADGE_POSITION_CLASS['top-left'];
  const shape = BADGE_SHAPE_CLASS[badge.shape ?? 'pill'] ?? BADGE_SHAPE_CLASS.pill;
  const size = BADGE_SIZE_CLASS[badge.size ?? 'sm'] ?? BADGE_SIZE_CLASS.sm;
  return `absolute ${pos} z-10 font-bold ${shape} ${size}`;
}

export function resolveBadgeStyle(
  badge: BadgeConfig,
  fallbackBg: string,
  fallbackText: string,
): CSSProperties {
  const s: CSSProperties = {};
  if (badge.bg_color) s.backgroundColor = badge.bg_color;
  else if (fallbackBg) s.backgroundColor = fallbackBg;
  if (badge.text_color) s.color = badge.text_color;
  else if (fallbackText) s.color = fallbackText;
  return s;
}

/**
 * Devuelve la clase estática de `object-fit` para la imagen de la card.
 * Se expone aparte porque se aplica al <img>, no al contenedor.
 */
export function resolveImageFitClass(fit: string | null | undefined): string {
  return IMAGE_FIT_CLASS[fit ?? 'cover'] ?? IMAGE_FIT_CLASS.cover;
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

interface ButtonContent {
  [key: string]: unknown;
  variant?: string | null;
  bg_color?: string | null;
  text_color?: string | null;
  radius?: number | null;
  size?: string | null;
  full_width_mobile?: boolean | null;
}

const BUTTON_SIZE_CLASS: Record<string, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-base px-4 py-2',
  lg: 'text-lg px-6 py-3',
  xl: 'text-xl px-8 py-4',
};

export function buildButtonStyle(button: ButtonContent | null | undefined): StyleResult {
  const b = button ?? {};
  const style: CSSProperties = {};
  const classes: string[] = [];

  const variant = (b.variant as string) ?? 'solid';
  classes.push(BUTTON_VARIANT_CLASS[variant] ?? BUTTON_VARIANT_CLASS.solid);

  // Tamaño
  const size = (b.size as string) ?? 'md';
  classes.push(BUTTON_SIZE_CLASS[size] ?? BUTTON_SIZE_CLASS.md);

  // Color de fondo / texto según variante
  if (variant === 'solid') {
    if (b.bg_color) {
      (style as Record<string, string>)['--btn-bg'] = b.bg_color as string;
      classes.push('bg-[var(--btn-bg)]');
    }
    if (b.text_color) {
      (style as Record<string, string>)['--btn-text'] = b.text_color as string;
      classes.push('text-[var(--btn-text)]');
    }
  } else if (variant === 'outline') {
    if (b.bg_color) {
      (style as Record<string, string>)['--btn-border'] = b.bg_color as string;
      classes.push('border-[color:var(--btn-border)]');
      if (b.text_color) {
        (style as Record<string, string>)['--btn-text'] = b.text_color as string;
        classes.push('text-[var(--btn-text)]');
      } else {
        (style as Record<string, string>)['--btn-text'] = b.bg_color as string;
        classes.push('text-[var(--btn-text)]');
      }
    }
  } else if (variant === 'ghost') {
    if (b.text_color) {
      (style as Record<string, string>)['--btn-text'] = b.text_color as string;
      classes.push('text-[var(--btn-text)]');
    }
  } else if (variant === 'link') {
    if (b.text_color) {
      (style as Record<string, string>)['--btn-text'] = b.text_color as string;
      classes.push('text-[var(--btn-text)]', 'underline');
    } else {
      classes.push('underline');
    }
  }

  // Radio
  const radius = typeof b.radius === 'number' ? b.radius : 0;
  if (radius > 0) {
    (style as Record<string, string>)['--btn-radius'] = px(radius);
    classes.push('rounded-[var(--btn-radius)]');
  }

  // Full width en móvil
  if (b.full_width_mobile !== false) {
    classes.push('w-full sm:w-auto');
  }

  return { className: classes.join(' '), style };
}
