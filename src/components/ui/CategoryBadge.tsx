// ─── CategoryBadge ────────────────────────────────────────────────────────────
//
// Badge reutilizable para mostrar una categoría dinámica (sistema v2.6).
// Usa el emoji, color y nombre de la Category de Dexie.
//
// Uso:
//   <CategoryBadge category={cat} />                     — badge normal
//   <CategoryBadge category={cat} size="sm" />           — pill pequeña
//   <CategoryBadge category={cat} onRemove={() => ...} /> — con × para quitar
//
// MIGRACIÓN FASE 6: este componente no cambia al migrar a SQL.
// Recibe un objeto Category (que vendrá del endpoint REST en lugar de Dexie).

import type { Category } from '../../db/types'

// ─── Paleta de colores por tipo de categoría ─────────────────────────────────
// Si la Category no tiene color definido, se usa el color por defecto del tipo.
const TYPE_DEFAULTS: Record<string, string> = {
  gender:    '#6d28d9',  // violeta
  olfactive: '#059669',  // esmeralda
  style:     '#2563eb',  // azul
  other:     '#6b7280',  // gris
}

function getColor(cat: Category): string {
  return cat.color ?? TYPE_DEFAULTS[cat.type] ?? '#6b7280'
}

// ─── Tipos de props ───────────────────────────────────────────────────────────

interface CategoryBadgeProps {
  category: Category
  size?: 'sm' | 'md'        // 'md' es el default
  onRemove?: () => void      // si se pasa, muestra el botón ×
  className?: string
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CategoryBadge({
  category,
  size = 'md',
  onRemove,
  className = '',
}: CategoryBadgeProps) {
  const color = getColor(category)

  // Estilos dinámicos basados en el color hex de la categoría
  const style: React.CSSProperties = {
    backgroundColor: color + '20',  // 12% opacidad como fondo suave
    color: color,
    borderColor: color + '40',      // 25% opacidad para el borde
  }

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-0.5'
    : 'text-xs px-2 py-0.5 gap-1'

  return (
    <span
      className={`inline-flex items-center border rounded-full font-medium ${sizeClasses} ${className}`}
      style={style}
      title={`${category.type}: ${category.name}`}
    >
      {category.emoji && (
        <span className="leading-none">{category.emoji}</span>
      )}
      <span>{category.name}</span>

      {onRemove && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="leading-none hover:opacity-70 transition-opacity ml-0.5"
          aria-label={`Quitar categoría ${category.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}

// ─── CategoryBadgeList ────────────────────────────────────────────────────────
//
// Renderiza una lista de badges para los categoryIds de un producto.
// Requiere el mapa completo de categorías para resolver slug → Category.
//
// Uso:
//   const cats = useLiveQuery(() => db.categories.toArray()) ?? []
//   const catMap = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats])
//   <CategoryBadgeList categoryIds={product.categoryIds} catMap={catMap} />

interface CategoryBadgeListProps {
  categoryIds?: string[]
  catMap: Map<string, Category>
  size?: 'sm' | 'md'
  onRemove?: (slug: string) => void
  className?: string
}

export function CategoryBadgeList({
  categoryIds,
  catMap,
  size = 'sm',
  onRemove,
  className = '',
}: CategoryBadgeListProps) {
  if (!categoryIds?.length) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {categoryIds.map(slug => {
        const cat = catMap.get(slug)
        if (!cat) return null  // slug huérfano (categoría eliminada) — se ignora
        return (
          <CategoryBadge
            key={slug}
            category={cat}
            size={size}
            onRemove={onRemove ? () => onRemove(slug) : undefined}
          />
        )
      })}
    </div>
  )
}
