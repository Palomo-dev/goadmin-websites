'use client';

import { useState, useEffect } from 'react';

/**
 * Hook que determina si el header debe renderizar su variante móvil.
 * Usa el breakpoint configurable desde settings. SiteHeader pasa 1024 como default.
 */
export function useMobileHeader(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}
