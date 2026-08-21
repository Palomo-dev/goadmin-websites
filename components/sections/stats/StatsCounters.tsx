interface StatItem {
  value: number
  label: string
  suffix?: string
  prefix?: string
}

interface StatsCountersProps {
  content: {
    items?: StatItem[]
  }
  primaryColor?: string
}

export function StatsCounters({ content, primaryColor }: StatsCountersProps) {
  const items = content.items || []

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      {items.map((item, i) => (
        <div key={i}>
          <div className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-white" style={{ color: primaryColor }}>
            {item.prefix}{item.value.toLocaleString('es-CO')}{item.suffix}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
