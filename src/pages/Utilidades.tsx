import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingUp, RefreshCw, PiggyBank, User, ArrowDownCircle } from 'lucide-react'
import { db } from '../db/db'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'

export function Utilidades() {
  const sales = useLiveQuery(() => db.sales.toArray()) ?? []
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const distributions = useLiveQuery(() => db.utilityDistributions.orderBy('startDate').reverse().toArray()) ?? []

  const [restockPct, setRestockPct] = useState('40')
  const [reinvestPct, setReinvestPct] = useState('30')
  const [personalPct, setPersonalPct] = useState('30')
  const [showDistribute, setShowDistribute] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)

  const [distForm, setDistForm] = useState({
    startDate: today().slice(0, 7) + '-01',
    endDate: today(),
    label: new Date().toLocaleDateString('es-PY', { month: 'long', year: 'numeric' }),
    restockPct: '40', reinvestPct: '30', personalPct: '30',
  })

  const [withdrawForm, setWithdrawForm] = useState({ amount: '', accountId: '', description: 'Retiro de ganancia personal' })

  // Calculate current period profit
  const currentMonth = today().slice(0, 7)
  const monthSales = sales.filter(s => s.date.startsWith(currentMonth))
  const monthProfit = monthSales.reduce((s, sale) => s + sale.totalProfit, 0)

  const totalProfit = sales.reduce((s, sale) => s + sale.totalProfit, 0)
  const totalDistributed = distributions.reduce((s, d) => s + d.grossProfit, 0)
  const undistributed = totalProfit - totalDistributed

  const restockAmount = undistributed * (parseFloat(restockPct) / 100)
  const reinvestAmount = undistributed * (parseFloat(reinvestPct) / 100)
  const personalAmount = undistributed * (parseFloat(personalPct) / 100)

  const totalPct = parseFloat(restockPct) + parseFloat(reinvestPct) + parseFloat(personalPct)

  async function handleDistribute() {
    const start = distForm.startDate
    const end = distForm.endDate
    const periodSales = sales.filter(s => s.date >= start && s.date <= end)
    const grossProfit = periodSales.reduce((s, sale) => s + sale.totalProfit, 0)
    const rPct = parseFloat(distForm.restockPct) / 100
    const riPct = parseFloat(distForm.reinvestPct) / 100
    const pPct = parseFloat(distForm.personalPct) / 100

    await db.utilityDistributions.add({
      periodLabel: distForm.label,
      startDate: start, endDate: end,
      grossProfit,
      restockPercent: parseFloat(distForm.restockPct),
      reinvestPercent: parseFloat(distForm.reinvestPct),
      personalPercent: parseFloat(distForm.personalPct),
      restockAmount: grossProfit * rPct,
      reinvestAmount: grossProfit * riPct,
      personalAmount: grossProfit * pPct,
      personalWithdrawn: 0,
      createdAt: nowISO(),
    })
    setShowDistribute(false)
  }

  async function handleWithdraw() {
    const amount = parseFloat(withdrawForm.amount)
    const accId = parseInt(withdrawForm.accountId)
    if (!amount || !accId) return
    const now = nowISO()
    await db.transaction('rw', db.movements, db.accounts, async () => {
      await db.movements.add({
        type: 'expense', category: 'personal_withdrawal',
        amount, accountId: accId,
        description: withdrawForm.description,
        date: today(), createdAt: now,
      })
      await db.accounts.where('id').equals(accId).modify(a => { a.balance -= amount })
    })
    setWithdrawForm({ amount: '', accountId: '', description: 'Retiro de ganancia personal' })
    setShowWithdraw(false)
  }

  return (
    <div>
      <PageHeader
        title="Utilidades"
        subtitle="Distribución de ganancias entre reposición, reinversión y retiro personal"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Utilidad total acumulada</p>
          <p className="text-2xl font-bold text-gray-900">{fmtPYG(totalProfit)}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-sm text-green-600">Utilidad este mes</p>
          <p className="text-2xl font-bold text-green-700">{fmtPYG(monthProfit)}</p>
          <p className="text-xs text-green-500">{monthSales.length} ventas</p>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
          <p className="text-sm text-violet-600">Total distribuido</p>
          <p className="text-2xl font-bold text-violet-700">{fmtPYG(totalDistributed)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-sm text-orange-600">Sin distribuir</p>
          <p className="text-2xl font-bold text-orange-700">{fmtPYG(undistributed)}</p>
        </div>
      </div>

      {/* Calculadora de distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Calculadora de distribución</h3>
            <p className="text-sm text-gray-500 mt-0.5">Sobre la utilidad pendiente de distribuir</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-3">
              {[
                { label: 'Reposición de stock', pct: restockPct, setPct: setRestockPct, icon: RefreshCw, color: 'blue' as const, amount: restockAmount },
                { label: 'Reinversión en el negocio', pct: reinvestPct, setPct: setReinvestPct, icon: TrendingUp, color: 'green' as const, amount: reinvestAmount },
                { label: 'Ganancia personal', pct: personalPct, setPct: setPersonalPct, icon: User, color: 'violet' as const, amount: personalAmount },
              ].map(({ label, pct, setPct, icon: Icon, color, amount }) => (
                <div key={label} className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${color === 'blue' ? 'bg-blue-50' : color === 'green' ? 'bg-green-50' : 'bg-violet-50'}`}>
                    <Icon size={16} className={color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : 'text-violet-600'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{label}</p>
                    <p className="text-xs text-gray-400">{fmtPYG(Math.round(amount))}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0" max="100"
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={pct}
                      onChange={e => setPct(e.target.value)}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              ))}
            </div>
            {totalPct !== 100 && (
              <p className={`text-sm ${totalPct > 100 ? 'text-red-500' : 'text-orange-500'}`}>
                Los porcentajes suman {totalPct}% (deben sumar 100%)
              </p>
            )}
            <div className="border-t border-gray-100 pt-3 flex gap-2">
              <Button className="flex-1" onClick={() => setShowDistribute(true)} disabled={totalPct !== 100}>
                Registrar distribución
              </Button>
              <Button variant="secondary" icon={<ArrowDownCircle size={15} />} onClick={() => setShowWithdraw(true)}>
                Retirar
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Resumen visual */}
        <Card>
          <CardHeader><h3 className="font-semibold text-gray-900">Resumen visual</h3></CardHeader>
          <CardBody>
            <div className="flex h-8 rounded-full overflow-hidden mb-4">
              <div style={{ width: `${restockPct}%` }} className="bg-blue-400 transition-all" />
              <div style={{ width: `${reinvestPct}%` }} className="bg-green-400 transition-all" />
              <div style={{ width: `${personalPct}%` }} className="bg-violet-500 transition-all" />
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Reposición', pct: restockPct, amount: restockAmount, color: 'bg-blue-400' },
                { label: 'Reinversión', pct: reinvestPct, amount: reinvestAmount, color: 'bg-green-400' },
                { label: 'Ganancia personal', pct: personalPct, amount: personalAmount, color: 'bg-violet-500' },
              ].map(({ label, pct, amount, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-gray-600">{label} ({pct}%)</span>
                  </div>
                  <span className="font-semibold text-gray-900">{fmtPYG(Math.round(amount))}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{fmtPYG(Math.round(undistributed))}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Historial distribuciones */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Historial de distribuciones</h2>
      <Card>
        {distributions.length === 0 ? (
          <CardBody className="text-center py-10">
            <PiggyBank size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No hay distribuciones registradas</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Período</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Utilidad bruta</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Reposición</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Reinversión</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Personal</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{d.periodLabel}</p>
                      <p className="text-xs text-gray-400">{fmtDate(d.startDate)} — {fmtDate(d.endDate)}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtPYG(d.grossProfit)}</td>
                    <td className="px-5 py-3 text-right text-blue-600">{fmtPYG(Math.round(d.restockAmount))} <span className="text-gray-400 text-xs">({d.restockPercent}%)</span></td>
                    <td className="px-5 py-3 text-right text-green-600">{fmtPYG(Math.round(d.reinvestAmount))} <span className="text-gray-400 text-xs">({d.reinvestPercent}%)</span></td>
                    <td className="px-5 py-3 text-right text-violet-600">{fmtPYG(Math.round(d.personalAmount))} <span className="text-gray-400 text-xs">({d.personalPercent}%)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal distribución */}
      <Modal isOpen={showDistribute} onClose={() => setShowDistribute(false)} title="Registrar distribución de utilidades">
        <div className="space-y-4">
          <Input label="Etiqueta del período" value={distForm.label} onChange={e => setDistForm(f => ({ ...f, label: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Desde" type="date" value={distForm.startDate} onChange={e => setDistForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="Hasta" type="date" value={distForm.endDate} onChange={e => setDistForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="% Reposición" type="number" value={distForm.restockPct} onChange={e => setDistForm(f => ({ ...f, restockPct: e.target.value }))} />
            <Input label="% Reinversión" type="number" value={distForm.reinvestPct} onChange={e => setDistForm(f => ({ ...f, reinvestPct: e.target.value }))} />
            <Input label="% Personal" type="number" value={distForm.personalPct} onChange={e => setDistForm(f => ({ ...f, personalPct: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowDistribute(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleDistribute}>Registrar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal retiro */}
      <Modal isOpen={showWithdraw} onClose={() => setShowWithdraw(false)} title="Registrar retiro personal">
        <div className="space-y-4">
          <Input label="Monto (Gs.)" type="number" value={withdrawForm.amount} onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))} />
          <Select
            label="Cuenta origen"
            value={withdrawForm.accountId}
            onChange={e => setWithdrawForm(f => ({ ...f, accountId: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
          />
          <Input label="Descripción" value={withdrawForm.description} onChange={e => setWithdrawForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowWithdraw(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleWithdraw}>Registrar retiro</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
