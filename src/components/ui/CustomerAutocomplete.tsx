import { useState, useRef, useEffect } from 'react'
import { UserCheck } from 'lucide-react'
import type { Customer } from '../../db/types'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  onSelect: (customer: Customer) => void
  customers: Customer[]
  placeholder?: string
  className?: string
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'

export function CustomerAutocomplete({ label, value, onChange, onSelect, customers, placeholder, className }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const suggestions = value.length >= 2
    ? customers.filter(c =>
        c.name.toLowerCase().includes(value.toLowerCase()) ||
        c.phone?.includes(value)
      ).slice(0, 6)
    : []

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className={`relative flex flex-col gap-1 ${className ?? ''}`} ref={containerRef}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => { if (value.length >= 2) setOpen(true) }}
        placeholder={placeholder ?? 'Nombre del cliente...'}
        className={inputClass}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => { onSelect(c); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-violet-50 text-left text-sm transition-colors border-b border-gray-50 last:border-0"
            >
              <UserCheck size={13} className="text-violet-400 shrink-0" />
              <span className="font-medium text-gray-900 flex-1 truncate">{c.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {c.ci && <span className="text-xs text-gray-400">CI {c.ci}</span>}
                {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
