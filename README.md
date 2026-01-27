# GO Admin Websites - Plataforma Multi-Tenant

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://goadmin.io)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=for-the-badge&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org)

## Descripción

Plataforma multi-tenant que permite a cada organización cliente del ERP GO Admin tener su propio sitio web personalizable bajo subdominios dinámicos (`empresa.goadmin.io`) o dominios personalizados.

### Características

- **Multi-tenancy** - Cada organización tiene su sitio web único
- **6 Templates visuales** - Modern, Classic, Bold, Minimal, Restaurant, E-commerce
- **SEO Dinámico** - Metadatos únicos por organización (OG tags, favicon, Twitter Cards)
- **Catálogo de productos** - Páginas de productos con precios dinámicos
- **Sistema de reservas** - Para restaurantes, hoteles, servicios
- **Supabase Storage** - Gestión de imágenes (logo, hero, galería)
- **100% Responsive** - Optimizado para móviles

## Arquitectura

```
Usuario accede a: empresa.goadmin.io
         │
         ▼
┌─────────────────────────────────────┐
│         Vercel + Next.js            │
│                                     │
│  Middleware → Queries → Supabase    │
│                                     │
│  Componentes del Sitio:             │
│  Header │ Hero │ Products │ Footer  │
└─────────────────────────────────────┘
```

## Estructura

```
├── app/
│   ├── api/            # APIs (contact, products, reservations)
│   ├── productos/      # Páginas de productos
│   ├── reservas/       # Sistema de reservas
│   └── page.tsx        # Homepage dinámica
├── components/site/    # Componentes del sitio
├── lib/
│   ├── supabase/       # Cliente y queries
│   └── templates/      # Configuración de templates
├── middleware.ts       # Resolución de subdominios
└── types/              # Tipos TypeScript
```

## Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

## Configuración DNS (Vercel)

| Name | Type | Value |
|------|------|-------|
| `*` | A | `76.76.21.21` |

## Desarrollo

```bash
npm install
npm run dev

# Probar con subdominio
http://localhost:3000?subdomain=empresa
```

## Licencia

Proyecto privado - GO Admin © 2024
