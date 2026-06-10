import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  sub?: string
  icon?: ReactNode
  color?: 'violet' | 'green' | 'red' | 'blue' | 'orange'
}

const colors = {
  violet: 'bg-violet-50 text-violet-600',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
}

export function StatCard({ label, value, sub, icon, color = 'violet' }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      {icon && (
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
