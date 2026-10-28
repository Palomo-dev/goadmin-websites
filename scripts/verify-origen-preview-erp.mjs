import assert from 'node:assert/strict'
import { esPreviewErpVercel } from '../lib/website/origenPreviewErp.ts'
const si = ['https://go-admin-erp-git-main-juan-camilo-gallegos-projects.vercel.app', 'https://go-admin-erp-git-fix-lienzo-2-juan-camilo-gallegos-projects.vercel.app', 'https://go-admin-3etj1gu9y-juan-camilo-gallegos-projects.vercel.app']
const no = ['http://go-admin-erp-git-main-juan-camilo-gallegos-projects.vercel.app', 'https://go-admin-erp-git-main-otro-equipo.vercel.app', 'https://evil.go-admin-3etj1gu9y-juan-camilo-gallegos-projects.vercel.app', 'https://go-admin-3etj1gu9y-juan-camilo-gallegos-projects.vercel.app.evil.com', 'https://go-admin-3etj1gu9y-juan-camilo-gallegos-projects.vercel.app:8443', 'https://go-admin-3etj1gu9y-juan-camilo-gallegos-projects.vercel.app/x', 'https://GO-ADMIN-ABC-juan-camilo-gallegos-projects.vercel.app', 'https://otro-3etj1gu9y-juan-camilo-gallegos-projects.vercel.app', 'https://go-admin-.-juan-camilo-gallegos-projects.vercel.app', 'null', '']
for (const o of si) assert.ok(esPreviewErpVercel(o), o)
for (const o of no) assert.ok(!esPreviewErpVercel(o), o)
console.log(`verify-origen-preview-erp: ${si.length + no.length} casos ok`)
