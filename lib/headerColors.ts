/**
 * Color utilities for header/topbar/nav customization.
 *
 * Strategy: user picks a background color (hex). Text color is auto-computed
 * (white or black) based on the luminance of the background, ensuring
 * WCAG AA contrast by default. The user does NOT need to pick a text color.
 */

/**
 * Returns the relative luminance of a hex color (0-1).
 * Uses the WCAG 2.0 formula.
 */
function hexLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return 1; // fallback: treat invalid as white
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Returns '#ffffff' or '#000000' depending on which has better contrast
 * against the given background hex color.
 */
export function getContrastTextColor(bgHex: string | null | undefined): string {
  if (!bgHex) return ''; // empty → inherit from CSS
  const lum = hexLuminance(bgHex);
  return lum > 0.5 ? '#111827' : '#ffffff'; // gray-900 or white
}

/**
 * Returns a semi-transparent version of a hex color with the given opacity
 * (0-100). If no hex color is provided, returns '' (inherit from CSS).
 */
export function hexWithOpacity(hex: string | null | undefined, opacity: number): string {
  if (!hex) return '';
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

/**
 * Returns a slightly darker version of a hex color (for hover states).
 * If no hex color is provided, returns ''.
 */
export function darkenHex(hex: string | null | undefined, amount = 0.1): string {
  if (!hex) return '';
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = Math.max(0, Math.round(parseInt(normalized.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(normalized.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(normalized.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Returns a slightly lighter version of a hex color (for hover on dark bg).
 */
export function lightenHex(hex: string | null | undefined, amount = 0.1): string {
  if (!hex) return '';
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = Math.min(255, Math.round(parseInt(normalized.slice(0, 2), 16) + (255 - parseInt(normalized.slice(0, 2), 16)) * amount));
  const g = Math.min(255, Math.round(parseInt(normalized.slice(2, 4), 16) + (255 - parseInt(normalized.slice(2, 4), 16)) * amount));
  const b = Math.min(255, Math.round(parseInt(normalized.slice(4, 6), 16) + (255 - parseInt(normalized.slice(4, 6), 16)) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Returns the hover color for text on a given background:
 * - On light bg: darken the text color
 * - On dark bg: lighten the text color
 */
export function getHoverTextColor(bgHex: string | null | undefined): string {
  if (!bgHex) return '';
  const lum = hexLuminance(bgHex);
  if (lum > 0.5) {
    // light bg → text is dark → hover slightly darker
    return darkenHex('#111827', 0.2);
  }
  // dark bg → text is white → hover slightly lighter (light gray)
  return lightenHex('#ffffff', 0.15);
}

export interface HeaderColors {
  /** Background color for the main header row (hex or null) */
  headerBg: string | null;
  /** Background color for the topbar (hex or null → inherits header) */
  topbarBg: string | null;
  /** Background color for the nav row (hex or null → inherits header) */
  navBg: string | null;
  /** Accent color for links/hover/badges (hex or null → uses primaryColor) */
  accent: string | null;
  /** Auto-computed text color for the header (white or dark) */
  headerText: string;
  /** Auto-computed text color for the topbar */
  topbarText: string;
  /** Auto-computed text color for the nav row */
  navText: string;
  /** Hover text color for the header */
  headerHover: string;
  /** Hover text color for the topbar */
  topbarHover: string;
  /** Hover text color for the nav row */
  navHover: string;
  /** Effective accent color (accent or primaryColor fallback) */
  accentEffective: string;
}

/**
 * Computes all derived colors from the user-configurable settings.
 * Pass `primaryColor` as the fallback for the accent color.
 */
export function computeHeaderColors(
  settings: {
    header_bg_color?: string | null;
    topbar_bg_color?: string | null;
    nav_bg_color?: string | null;
    accent_color?: string | null;
  } | null | undefined,
  primaryColor: string,
): HeaderColors {
  const headerBg = settings?.header_bg_color ?? null;
  const topbarBg = settings?.topbar_bg_color ?? null;
  const navBg = settings?.nav_bg_color ?? null;
  const accent = settings?.accent_color ?? null;
  const accentEffective = accent || primaryColor;

  return {
    headerBg,
    topbarBg,
    navBg,
    accent,
    headerText: getContrastTextColor(headerBg),
    topbarText: getContrastTextColor(topbarBg || headerBg),
    navText: getContrastTextColor(navBg || headerBg),
    headerHover: getHoverTextColor(headerBg),
    topbarHover: getHoverTextColor(topbarBg || headerBg),
    navHover: getHoverTextColor(navBg || headerBg),
    accentEffective,
  };
}
