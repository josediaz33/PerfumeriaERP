import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Wallet, Building2, Smartphone, CreditCard, ArrowLeftRight, Trash2, Edit2, History } from 'lucide-react'
import { db } from '../db/db'
import type { AccountType, Account, Movement } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const typeIcons: Record<AccountType, typeof Wallet> = {
  cash: Wallet,
  bank: Building2,
  digital_wallet: Smartphone,
  other: CreditCard,
}

const typeLabels: Record<AccountType, string> = {
  cash: 'Efectivo',
  bank: 'Bancaria',
  digital_wallet: 'Billetera Digital',
  other: 'Otra',
}

const typeColors: Record<AccountType, 'green' | 'blue' | 'violet' | 'gray'> = {
  cash: 'green',
  bank: 'blue',
  digital_wallet: 'violet',
  other: 'gray',
}

const typeOptions = [
  { value: 'cash', label: 'Efectivo (Caja)' },
  { value: 'bank', label: 'Bancaria' },
  { value: 'digital_wallet', label: 'Billetera Digital' },
  { value: 'other', label: 'Otra' },
]

export function Cuentas() {
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const allMovements = useLiveQuery(() => db.movements.orderBy('date').reverse().toArray()) ?? []

  // ── Historial por cuenta ──
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null)
  const [historyMonth, setHistoryMonth] = useState(() => today().slice(0, 7))

  // ── Nueva cuenta ──
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'cash' as AccountType, initialBalance: '0' })

  // ── Editar cuenta ──
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', type: 'cash' as AccountType, newBalance: '', balanceNote: '',
  })

  // ── Transferencia ──
  const [showTransfer, setShowTransfer] = useState(false)
  const [transfer, setTransfer] = useState({ fromId: '', toId: '', amount: '', description: '', date: '' })

  // ── Editar transferencia ──
  const [editTransfer, setEditTransfer] = useState<Movement | null>(null)
  const [editTransferForm, setEditTransferForm] = useState({ date: '', description: '' })

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  // ── Nueva cuenta ──
  async function handleCreate() {
    if (!form.name.trim()) return
    const balance = parseFloat(form.initialBalance) || 0
    const now = nowISO()
    const id = await db.accounts.add({
      name: form.name,
      type: form.type,
      balance,
      currency: 'PYG',
      createdAt: now,
      isActive: true,
    })
    if (balance > 0) {
      await db.movements.add({
        type: 'income',
        category: 'other',
        amount: balance,
        accountId: id as number,
        description: `Saldo inicial: ${form.name}`,
        date: now.split('T')[0],
        createdAt: now,
      })
    }
    setForm({ name: '', type: 'cash', initialBalance: '0' })
    setShowNew(false)
  }

  // ── Editar cuenta ──
  function openEdit(account: Account) {
    setEditAccount(account)
    setEditForm({
      name: account.name,
      type: account.type,
      newBalance: String(account.balance),
      balanceNote: '',
    })
  }

  function closeEdit() {
    setEditAccount(null)
    setEditForm({ name: '', type: 'cash', newBalance: '', balanceNote: '' })
  }

  async function handleEdit() {
    if (!editAccount || !editForm.name.trim()) return
    const newBalance = parseFloat(editForm.newBalance) || 0
    const diff = newBalance - editAccount.balance
    const now = nowISO()

    if (Math.abs(diff) > 0.01) {
      // Balance changed: create an adjustment movement for audit trail
      await db.transaction('rw', db.accounts, db.movements, async () => {
        await db.accounts.update(editAccount.id!, {
          name: editForm.name,
          type: editForm.type,
          balance: newBalance,
        })
        await db.movements.add({
          type: diff > 0 ? 'income' : 'expense',
          category: 'other',
          amount: Math.abs(diff),
          accountId: editAccount.id!,
          description: editForm.balanceNote.trim() || `Ajuste de saldo — ${editForm.name}`,
          date: now.split('T')[0],
          createdAt: now,
        })
      })
    } else {
      await db.accounts.update(editAccount.id!, {
        name: editForm.name,
        type: editForm.type,
      })
    }
    closeEdit()
  }

  // ── Transferencia ──
  async function handleTransfer() {
    const from = parseInt(transfer.fromId)
    const to = parseInt(transfer.toId)
    const amount = parseFloat(transfer.amount)
    if (!from || !to || !amount || from === to) return
    const now = nowISO()
    const date = transfer.date || now.split('T')[0]

    await db.transaction('rw', db.accounts, db.movements, async () => {
      await db.accounts.where('id').equals(from).modify(a => { a.balance -= amount })
      await db.accounts.where('id').equals(to).modify(a => { a.balance += amount })
      await db.movements.add({
        type: 'transfer',
        category: 'transfer',
        amount,
        accountId: from,
        toAccountId: to,
        description: transfer.description || 'Transferencia entre cuentas',
        date,
        createdAt: now,
      })
    })
    setTransfer({ fromId: '', toId: '', amount: '', description: '', date: '' })
    setShowTransfer(false)
  }

  // ── Editar transferencia ──
  function openEditTransfer(m: Movement) {
    setEditTransfer(m)
    setEditTransferForm({ date: m.date, description: m.description })
  }

  async function handleEditTransfer() {
    if (!editTransfer) return
    await db.movements.update(editTransfer.id!, {
      date: editTransferForm.date,
      description: editTransferForm.description,
    })
    setEditTransfer(null)
  }

  // ── Eliminar cuenta ──
  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta cuenta?')) return
    await db.accounts.update(id, { isActive: false })
  }

  // ── Recalcular saldo desde movimientos ──
  async function recalculateBalance(accountId: number) {
    const movements = await db.movements.toArray()
    let balance = 0
    for (const m of movements) {
      if (m.type === 'income' && m.accountId === accountId) balance += m.amount
      else if (m.type === 'expense' && m.accountId === accountId) balance -= m.amount
      else if (m.type === 'transfer') {
        if (m.accountId === accountId) balance -= m.amount
        if (m.toAccountId === accountId) balance += m.amount
      }
    }
    await db.accounts.update(accountId, { balance: Math.round(balance) })
    if (editAccount?.id === accountId) {
      setEditForm(f => ({ ...f, newBalance: String(Math.round(balance)) }))
    }
  }

  // Balance diff display (for edit modal)
  const editNewBalance = parseFloat(editForm.newBalance) || 0
  const editDiff = editAccount ? editNewBalance - editAccount.balance : 0
  const hasBalanceChange = Math.abs(editDiff) > 0.01

  return (
    <div>
      <PageHeader
        title="Cuentas"
        subtitle="Gestión de caja, bancos y billeteras digitales"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<ArrowLeftRight size={15} />} onClick={() => setShowTransfer(true)}>
              Transferir
            </Button>
            <Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>
              Nueva cuenta
            </Button>
          </div>
        }
      />

      {/* Capital total */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-700 rounded-2xl p-6 mb-6 text-white">
        <p className="text-violet-200 text-sm font-medium">Capital total disponible</p>
        <p className="text-4xl font-bold mt-1">{fmtPYG(totalBalance)}</p>
        <p className="text-violet-300 text-sm mt-2">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} activa{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(account => {
          const Icon = typeIcons[account.type]
          return (
            <Card key={account.id} className="relative">
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gray-50">
                      <Icon size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{account.name}</p>
                      <Badge color={typeColors[account.type]}>{typeLabels[account.type]}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setHistoryAccount(account); setHistoryMonth(today().slice(0, 7)) }}
                      className="p-1.5 rounded-lg text-gray-300 hover:bg-violet-50 hover:text-violet-600 transition-all cursor-pointer"
                      title="Ver historial"
                    >
                      <History size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(account)}
                      className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-all cursor-pointer"
                      title="Editar cuenta"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id!)}
                      className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer"
                      title="Eliminar cuenta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-2xl font-bold text-gray-900">{fmtPYG(account.balance)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Saldo actual</p>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {accounts.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <Wallet size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No hay cuentas registradas</p>
            <p className="text-sm text-gray-400">Crea tu primera cuenta para empezar</p>
          </CardBody>
        </Card>
      )}

      {/* Modal nueva cuenta */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Nueva cuenta">
        <div className="space-y-4">
          <Input
            label="Nombre de la cuenta"
            placeholder="Ej: Caja principal, Itaú, Billetera Personal"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="Tipo"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}
            options={typeOptions}
          />
          <Input
            label="Saldo inicial (Gs.)"
            type="number"
            value={form.initialBalance}
            onChange={e => setForm(f => ({ ...f, initialBalance: e.target.value }))}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreate}>Crear cuenta</Button>
          </div>
        </div>
      </Modal>

      {/* Modal editar cuenta */}
      <Modal isOpen={!!editAccount} onClose={closeEdit} title="Editar cuenta">
        {editAccount && (
          <div className="space-y-4">
            <Input
              label="Nombre"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
            <Select
              label="Tipo"
              value={editForm.type}
              onChange={e => setEditForm(f => ({ ...f, type: e.target.value as AccountType }))}
              options={typeOptions}
            />

            {/* Balance correction */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Corrección de saldo</p>
                <button
                  onClick={() => recalculateBalance(editAccount.id!)}
                  className="text-xs text-violet-600 hover:text-violet-800 underline cursor-pointer"
                  title="Recalcula el saldo sumando todos los movimientos registrados para esta cuenta"
                >
                  Recalcular desde movimientos
                </button>
              </div>
              <div className="flex items-center justify-between text-sm mb-3 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-500">Saldo actual</span>
                <span className="font-bold text-gray-900">{fmtPYG(editAccount.balance)}</span>
              </div>
              <Input
                label="Saldo corregido (Gs.)"
                type="number"
                value={editForm.newBalance}
                onChange={e => setEditForm(f => ({ ...f, newBalance: e.target.value }))}
              />
              {hasBalanceChange && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">Ajuste automático:</span>
                    <span className={`font-semibold ${editDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {editDiff > 0 ? '+' : ''}{fmtPYG(Math.round(editDiff))}
                    </span>
                    <span className="text-gray-400">— se registrará en Contabilidad</span>
                  </div>
                  <Input
                    label="Motivo del ajuste (opcional)"
                    placeholder="Ej: Corrección de saldo inicial, diferencia de caja"
                    value={editForm.balanceNote}
                    onChange={e => setEditForm(f => ({ ...f, balanceNote: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={closeEdit}>Cancelar</Button>
              <Button className="flex-1" onClick={handleEdit}>Guardar cambios</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal historial de cuenta */}
      <Modal isOpen={!!historyAccount} onClose={() => setHistoryAccount(null)} title={`Historial — ${historyAccount?.name ?? ''}`} size="lg">
        {historyAccount && (() => {
          const accountMovements = allMovements.filter(m =>
            (m.accountId === historyAccount.id || m.toAccountId === historyAccount.id) &&
            m.date.startsWith(historyMonth)
          )
          const income = accountMovements.filter(m => m.type === 'income' || m.toAccountId === historyAccount.id && m.type === 'transfer').reduce((s, m) => s + m.amount, 0)
          const expense = accountMovements.filter(m => m.type === 'expense' || m.accountId === historyAccount.id && m.type === 'transfer').reduce((s, m) => s + m.amount, 0)
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={historyMonth}
                  onChange={e => setHistoryMonth(e.target.value)}
                />
                <span className="text-sm text-gray-400 ml-auto">{accountMovements.length} movimientos</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-green-50 rounded-lg px-3 py-2">
                  <p className="text-green-600 font-medium">Ingresos</p>
                  <p className="font-bold text-green-700">{fmtPYG(income)}</p>
                </div>
                <div className="bg-red-50 rounded-lg px-3 py-2">
                  <p className="text-red-600 font-medium">Egresos</p>
                  <p className="font-bold text-red-700">{fmtPYG(expense)}</p>
                </div>
                <div className="bg-violet-50 rounded-lg px-3 py-2">
                  <p className="text-violet-600 font-medium">Saldo actual</p>
                  <p className="font-bold text-violet-700">{fmtPYG(historyAccount.balance)}</p>
                </div>
              </div>
              {accountMovements.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Sin movimientos en este período</p>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Fecha</th>
                        <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Descripción</th>
                        <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Monto</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {accountMovements.map(m => {
                        const isIncoming = m.type === 'income' || (m.type === 'transfer' && m.toAccountId === historyAccount.id)
                        const isOutgoing = m.type === 'expense' || (m.type === 'transfer' && m.accountId === historyAccount.id)
                        return (
                          <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(m.date)}</td>
                            <td className="px-4 py-2.5 text-gray-700">{m.description}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${isIncoming ? 'text-green-600' : isOutgoing ? 'text-red-600' : 'text-violet-600'}`}>
                              {isIncoming ? '+' : isOutgoing ? '−' : '↔'} {fmtPYG(m.amount)}
                            </td>
                            <td className="pr-2">
                              {m.type === 'transfer' && (
                                <button
                                  onClick={() => openEditTransfer(m)}
                                  className="p-1 rounded text-gray-300 hover:text-violet-600 hover:bg-violet-50 transition-all cursor-pointer"
                                  title="Editar transferencia"
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Modal transferencia */}
      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title="Transferir entre cuentas">
        <div className="space-y-4">
          <Select
            label="Desde"
            value={transfer.fromId}
            onChange={e => setTransfer(t => ({ ...t, fromId: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar cuenta...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
          />
          <Select
            label="Hacia"
            value={transfer.toId}
            onChange={e => setTransfer(t => ({ ...t, toId: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar cuenta...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
          />
          <Input
            label="Monto (Gs.)"
            type="number"
            value={transfer.amount}
            onChange={e => setTransfer(t => ({ ...t, amount: e.target.value }))}
          />
          <Input
            label="Fecha"
            type="date"
            value={transfer.date}
            onChange={e => setTransfer(t => ({ ...t, date: e.target.value }))}
          />
          <Input
            label="Descripción (opcional)"
            value={transfer.description}
            onChange={e => setTransfer(t => ({ ...t, description: e.target.value }))}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowTransfer(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleTransfer}>Transferir</Button>
          </div>
        </div>
      </Modal>

      {/* Modal editar transferencia */}
      <Modal isOpen={!!editTransfer} onClose={() => setEditTransfer(null)} title="Editar transferencia">
        {editTransfer && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500">
              Monto: <span className="font-semibold text-gray-900">{fmtPYG(editTransfer.amount)}</span>
              <span className="mx-2 text-gray-300">·</span>
              Solo se puede modificar la fecha y descripción.
            </div>
            <Input
              label="Fecha"
              type="date"
              value={editTransferForm.date}
              onChange={e => setEditTransferForm(f => ({ ...f, date: e.target.value }))}
            />
            <Input
              label="Descripción"
              value={editTransferForm.description}
              onChange={e => setEditTransferForm(f => ({ ...f, description: e.target.value }))}
            />
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditTransfer(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleEditTransfer}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
