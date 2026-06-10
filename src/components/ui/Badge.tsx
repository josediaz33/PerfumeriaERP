import type { ReactNode } from 'react'

type Color = 'violet' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange'

interface Props {
  children: ReactNode
  color?: Color
}

const colors: Record<Color, string> = {
  violet: 'bg-violet-100 text-violet-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
  orange: 'bg-orange-100 text-orange-700',
}

export function Badge({ children, color = 'gray' }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}
