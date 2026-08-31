import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Número total de ítems — si se pasa junto con pageSize, muestra el label "X–Y de Z" */
  total?: number
  pageSize?: number
  className?: string
}

/** Números de página a mostrar: primera, última y ±1 del actual, con ellipsis entre saltos */
function pageRange(current: number, total: number): (number | '…')[] {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  const visible = pages.filter(n => n === 1 || n === total || Math.abs(n - current) <= 1)
  return visible.reduce<(number | '…')[]>((acc, n, i, arr) => {
    if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…')
    acc.push(n)
    return acc
  }, [])
}

export function Pagination({ page, totalPages, onPageChange, total, pageSize, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null

  const showLabel = total !== undefined && pageSize !== undefined
  const from = (page - 1) * (pageSize ?? 0) + 1
  const to = Math.min(page * (pageSize ?? 0), total ?? 0)

  return (
    <div className={`flex items-center justify-between px-5 py-3 border-t border-gray-100 ${className}`}>
      {showLabel ? (
        <p className="text-xs text-gray-400">
          {from}–{to} de {total}
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          aria-label="Página anterior"
        >
          <ChevronLeft size={14} />
        </button>

        {pageRange(page, totalPages).map((n, i) =>
          n === '…' ? (
            <span key={`dots-${i}`} className="px-1.5 text-xs text-gray-300 select-none">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                page === n ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
              aria-label={`Página ${n}`}
              aria-current={page === n ? 'page' : undefined}
            >
              {n}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          aria-label="Página siguiente"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
