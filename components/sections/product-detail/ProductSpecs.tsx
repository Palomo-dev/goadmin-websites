'use client'

import { buildCardStyle } from '@/lib/sectionStyle'

interface ProductSpecsProps {
  content: Record<string, any>
  data?: Record<string, any>
  primaryColor?: string
}

export function ProductSpecs({ content, data }: ProductSpecsProps) {
  const product = data?.product
  if (!product) return null

  const title = content.title || 'Especificaciones técnicas'
  const layout = content.layout || 'table'
  const showEmpty = content.show_empty ?? false
  const groupByCategory = content.group_by_category ?? true
  const columns = Number(content.columns ?? 3)
  const gap = content.gap ?? 16
  const radius = typeof content.radius === 'number' ? content.radius : 0
  const borderWidth = typeof content.border_width === 'number' ? content.border_width : 0

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns] || 'grid-cols-3'

  const mdGridColsClass = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  }[columns] || 'md:grid-cols-3'

  const { className: cardClassName, style: cardStyle } = buildCardStyle(content)

  // Extraer atributos del producto
  const attributes = (product.product_attributes || product.attributes || []) as Array<{
    name: string
    value: string
    category?: string
  }>

  // Filtrar vacíos si showEmpty es false
  const filtered = showEmpty ? attributes : attributes.filter(a => a.value && a.value.trim())

  if (filtered.length === 0) return null

  // Agrupar por categoría si está activado
  const grouped = groupByCategory
    ? filtered.reduce((acc, attr) => {
        const cat = attr.category || 'General'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(attr)
        return acc
      }, {} as Record<string, typeof filtered>)
    : { General: filtered }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      {Object.entries(grouped).map(([category, attrs]) => (
        <div key={category}>
          {groupByCategory && Object.keys(grouped).length > 1 && (
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{category}</h3>
          )}
          {layout === 'table' && (
            <table
              className="w-full text-sm"
              style={{
                borderRadius: radius > 0 ? `${radius}px` : undefined,
                borderWidth: borderWidth > 0 ? `${borderWidth}px` : undefined,
                borderCollapse: borderWidth > 0 ? 'separate' : undefined,
                borderStyle: borderWidth > 0 ? 'solid' : undefined,
                borderColor: content.border_color || undefined,
                overflow: 'hidden',
              }}
            >
              <tbody>
                {attrs.map((attr, i) => (
                  <tr key={i} className="border-b dark:border-gray-700">
                    <td className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-300 w-1/3">{attr.name}</td>
                    <td className="py-2 text-gray-900 dark:text-white">{attr.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {layout === 'grid' && (
            <div className={`grid grid-cols-2 ${mdGridColsClass}`} style={{ gap: `${gap}px` }}>
              {attrs.map((attr, i) => (
                <div key={i} className={`border rounded-lg p-3 dark:border-gray-700 ${cardClassName}`} style={cardStyle}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{attr.name}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{attr.value}</p>
                </div>
              ))}
            </div>
          )}
          {layout === 'list' && (
            <ul className="space-y-2">
              {attrs.map((attr, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{attr.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{attr.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
