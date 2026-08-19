import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, TrendingUp, TrendingDown, Filter, Edit2, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { MovementCategory, MovementType, Movement } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const categories: { value: MovementCategory; label: string; type: MovementType }[] = [
  { value: 'sale', label: 'Venta', type: 'income' },
  { value: 'restock', label: 'Reposición de stock', type: 'expense' },
  { value: 'supplies', label: 'Insumos', type: 'expense' },
  { value: 'packaging', label: 'Packaging', type: 'expense' },
  { value: 'shipping', label: 'Envío', type: 'expense' },
  { value: 'services', label: 'Servicios', type: 'expense' },
  { value: 'personal_withdrawal', label: 'Retiro personal', type: 'expense' },
  { value: 'personal_return', label: 'Devolución personal', type: 'income' },
  { value: 'other', label: 'Otro ingreso', type: 'income' },
]

const categoryColors: Record<MovementCategory, 'green' | 'red' | 'orange' | 'blue' | 'violet' | 'gray'> = {
  sale: 'green',
  restock: 'orange',
  supplies: 'blue',
  packaging: 'blue',
  shipping: 'blue',
  services: 'gray',
  personal_withdrawal: 'red',
  personal_return: 'green',
  transfer: 'violet',
  other: 'gray',
}

export function Contabilidad() {
  const location = useLocation()
  const navState = location.state as { highlightId?: number; month?: string } | null
  const highlightId = navState?.highlightId
  const highlightRef = useRef<HTMLTableRowElement | null>(null)

  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const [filterMonth, setFilterMonth] = useState(() => navState?.month ?? today().slice(0, 7))
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')

  const movements = useLiveQuery(async () => {
    const all = await db.movements.orderBy('date').reverse().toArray()
    return all.filter(m => {
      if (filterMonth && !m.date.startsWith(filterMonth)) return false
      if (filterType !== 'all' && m.type !== filterType) return false
      if (filterAccount !== 'all' && String(m.accountId) !== filterAccount && String(m.toAccountId) !== filterAccount) return false
      return true
    })
  }, [filterMonth, filterType, filterAccount]) ?? []

  const income = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0)
  const expense = movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0)
  const balance = income - expense

  // Scroll y highlight al movimiento indicado por navegación desde Logística.
  // Se usa requestAnimationFrame para garantizar que el DOM ya tiene la fila renderizada.
  useEffect(() => {
    if (!highlightId || movements.length === 0) return
    const exists = movements.some(m => m.id === highlightId)
    if (!exists) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })
  }, [movements, highlightId])

  const [showNew, setShowNew] = useState(false)
  const [editMovement, setEditMovement] = useState<Movement | null>(null)
  const [form, setForm] = useState({
    type: 'income' as MovementType,
    category: 'other' as MovementCategory,
    amount: '',
    accountId: '',
    description: '',
    date: today(),
  })

  function openEdit(m: Movement) {
    setEditMovement(m)
    setForm({
      type: m.type === 'transfer' ? 'income' : m.type as 'income' | 'expense',
      category: m.category,
      amount: String(m.amount),
      accountId: String(m.accountId),
      description: m.description,
      date: m.date,
    })
    setShowNew(true)
  }

  function closeModal() {
    setShowNew(false)
    setEditMovement(null)
    setForm({ type: 'income', category: 'other', amount: '', accountId: '', description: '', date: today() })
  }

  async function handleCreate() {
    if (!form.amount || !form.accountId || !form.description.trim()) return
    const amount = parseFloat(form.amount)
    const accountId = parseInt(form.accountId)
    const now = nowISO()

    await db.transaction('rw', db.movements, db.accounts, async () => {
      await db.movements.add({
        type: form.type,
        category: form.category,
        amount,
        accountId,
        description: form.description,
        date: form.date,
        createdAt: now,
      })
      const delta = form.type === 'income' ? amount : -amount
      await db.accounts.where('id').equals(accountId).modify(a => { a.balance += delta })
    })
    closeModal()
  }

  async function handleEditSave() {
    if (!editMovement || !form.amount || !form.accountId) return
    const amount = parseFloat(form.amount)
    const accountId = parseInt(form.accountId)

    await db.transaction('rw', db.movements, db.accounts, async () => {
      // Revertir efecto anterior
      const oldDelta = editMovement.type === 'income' ? -editMovement.amount : editMovement.amount
      await db.accounts.where('id').equals(editMovement.accountId).modify(a => { a.balance += oldDelta })
      // Aplicar nuevo efecto
      const newDelta = form.type === 'income' ? amount : -amount
      await db.accounts.where('id').equals(accountId).modify(a => { a.balance += newDelta })
      await db.movements.update(editMovement.id!, {
        type: form.type, category: form.category,
        amount, accountId, description: form.description, date: form.date,
      })
    })
    closeModal()
  }

  async function handleDelete(m: Movement) {
    const isRestock = m.category === 'restock' && m.referenceType === 'stock_entry' && m.referenceId
    const confirmMsg = isRestock
      ? '¿Eliminar este movimiento? El saldo de la cuenta y el lote de stock asociado serán revertidos.'
      : '¿Eliminar este movimiento? El saldo de la cuenta se ajustará automáticamente.'
    if (!confirm(confirmMsg)) return

    if (m.type === 'transfer') {
      await db.transaction('rw', db.movements, db.accounts, async () => {
        await db.accounts.where('id').equals(m.accountId).modify(a => { a.balance += m.amount })
        if (m.toAccountId) await db.accounts.where('id').equals(m.toAccountId).modify(a => { a.balance -= m.amount })
        await db.movements.delete(m.id!)
      })
      return
    }

    const delta = m.type === 'income' ? -m.amount : m.amount

    if (isRestock && m.referenceId) {
      const entry = await db.stockEntries.get(m.referenceId)
      if (entry) {
        const product = await db.products.get(entry.productId)
        if (product) {
          const remaining = await db.stockEntries
            .where('productId').equals(entry.productId)
            .filter(e => e.id !== entry.id)
            .toArray()
          const totalQty = remaining.reduce((s, e) => s + e.quantity, 0)
          const newCPP = totalQty > 0 ? remaining.reduce((s, e) => s + e.costPYG * e.quantity, 0) / totalQty : 0
          const newCostUSD = totalQty > 0 ? remaining.reduce((s, e) => s + e.costUSD * e.quantity, 0) / totalQty : 0
          await db.transaction('rw', db.movements, db.accounts, db.stockEntries, db.products, async () => {
            await db.products.where('id').equals(product.id!).modify(p => {
              if (entry.type === 'sealed') p.stockSealed = Math.max(0, p.stockSealed - entry.quantity)
              else p.stockOpenML = Math.max(0, p.stockOpenML - entry.quantity)
              p.costPYG = newCPP
              p.costUSD = newCostUSD
            })
            await db.stockEntries.delete(entry.id!)
            await db.accounts.where('id').equals(m.accountId).modify(a => { a.balance += delta })
            await db.movements.delete(m.id!)
          })
          return
        }
      }
    }

    await db.transaction('rw', db.movements, db.accounts, async () => {
      await db.accounts.where('id').equals(m.accountId).modify(a => { a.balance += delta })
      await db.movements.delete(m.id!)
    })
  }


  return (
    <div>
      <PageHeader
        title="Contabilidad"
        subtitle="Registro diario de ingresos y egresos"
        action={<Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>Nuevo movimiento</Button>}
      />

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <TrendingUp size={16} />
            <span className="text-sm font-medium">Ingresos</span>
          </div>
          <p className="text-xl font-bold text-green-700">{fmtPYG(income)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <TrendingDown size={16} />
            <span className="text-sm font-medium">Egresos</span>
          </div>
          <p className="text-xl font-bold text-red-700">{fmtPYG(expense)}</p>
        </div>
        <div className={`${balance >= 0 ? 'bg-violet-50 border-violet-100' : 'bg-orange-50 border-orange-100'} border rounded-xl p-4`}>
          <p className="text-sm font-medium text-gray-600 mb-1">Balance neto</p>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-violet-700' : 'text-orange-700'}`}>{fmtPYG(balance)}</p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap gap-3 items-center">
          <Filter size={15} className="text-gray-400 shrink-0" />
          <input
            type="month"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          />
          <div className="flex gap-1">
            {(['all', 'income', 'expense'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-sm cursor-pointer transition-colors ${filterType === t ? 'bg-violet-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                {t === 'all' ? 'Todos' : t === 'income' ? 'Ingresos' : 'Egresos'}
              </button>
            ))}
          </div>
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
            value={filterAccount}
            onChange={e => setFilterAccount(e.target.value)}
          >
            <option value="all">Todas las cuentas</option>
            {accounts.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
          </select>
          <span className="text-sm text-gray-400 ml-auto">{movements.length} movimientos</span>
        </CardBody>
      </Card>

      {/* Tabla */}
      <Card>
        {movements.length === 0 ? (
          <CardBody className="text-center py-12">
            <p className="text-gray-400">No hay movimientos para el período seleccionado</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Descripción</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Categoría</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Cuenta</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Monto</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {movements.map(m => {
                  const account = accounts.find(a => a.id === m.accountId)
                  const cat = categories.find(c => c.value === m.category)
                  return (
                    <tr
                      key={m.id}
                      ref={m.id === highlightId ? highlightRef : undefined}
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${m.id === highlightId ? 'bg-violet-50 outline outline-1 outline-violet-300' : ''}`}
                    >
                      <td className="px-5 py-3 text-gray-500">{fmtDate(m.date)}</td>
                      <td className="px-5 py-3 text-gray-900">{m.description}</td>
                      <td className="px-5 py-3">
                        <Badge color={categoryColors[m.category]}>{cat?.label ?? m.category}</Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{account?.name ?? '—'}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${m.type === 'income' ? 'text-green-600' : m.type === 'expense' ? 'text-red-600' : 'text-violet-600'}`}>
                        {m.type === 'income' ? '+' : m.type === 'expense' ? '−' : '↔'} {fmtPYG(m.amount)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {m.type !== 'transfer' && (
                            <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
                              <Edit2 size={13} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(m)} className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal nuevo / editar movimiento */}
      <Modal isOpen={showNew} onClose={closeModal} title={editMovement ? 'Editar movimiento' : 'Nuevo movimiento'}>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['income', 'expense'] as MovementType[]).map(t => (
              <button
                key={t}
                onClick={() => { setForm(f => ({ ...f, type: t, category: t === 'income' ? 'other' : 'restock' })) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${form.type === t ? (t === 'income' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {t === 'income' ? 'Ingreso' : 'Egreso'}
              </button>
            ))}
          </div>
          <Select
            label="Categoría"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value as MovementCategory }))}
            options={categories.filter(c => c.type === form.type).map(c => ({ value: c.value, label: c.label }))}
          />
          <Input
            label="Descripción"
            placeholder="¿De qué es este movimiento?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <Input
            label="Monto (Gs.)"
            type="number"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
          <Select
            label="Cuenta"
            value={form.accountId}
            onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
          />
          <Input
            label="Fecha"
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
            <Button className="flex-1" onClick={editMovement ? handleEditSave : handleCreate}>
              {editMovement ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
