import { useState, useEffect } from 'react'
import { Settings, Save, Download, Upload, RefreshCw } from 'lucide-react'
import { db, getConfig, setConfig } from '../db/db'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export function Configuracion() {
  const [businessName, setBusinessName] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [usdRate, setUsdRate] = useState('7500')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      setBusinessName(await getConfig('business_name'))
      setBusinessPhone(await getConfig('business_phone'))
      setBusinessAddress(await getConfig('business_address'))
      setUsdRate(await getConfig('usd_pyg_rate'))
    }
    load()
  }, [])

  async function handleSave() {
    await setConfig('business_name', businessName)
    await setConfig('business_phone', businessPhone)
    await setConfig('business_address', businessAddress)
    await setConfig('usd_pyg_rate', usdRate)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function fetchExchangeRate() {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      const data = await res.json()
      const pygRate = data.rates?.PYG
      if (pygRate) {
        setUsdRate(Math.round(pygRate).toString())
        alert(`Cotización actualizada: 1 USD = Gs. ${Math.round(pygRate).toLocaleString('es-PY')}`)
      }
    } catch {
      alert('No se pudo obtener la cotización. Ingresala manualmente.')
    }
  }

  async function exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      accounts: await db.accounts.toArray(),
      movements: await db.movements.toArray(),
      products: await db.products.toArray(),
      stockEntries: await db.stockEntries.toArray(),
      supplies: await db.supplies.toArray(),
      decantBatches: await db.decantBatches.toArray(),
      sales: await db.sales.toArray(),
      saleItems: await db.saleItems.toArray(),
      customers: await db.customers.toArray(),
      suppliers: await db.suppliers.toArray(),
      supplierPrices: await db.supplierPrices.toArray(),
      orders: await db.orders.toArray(),
      localOrders: await db.localOrders.toArray(),
      budgets: await db.budgets.toArray(),
      utilityDistributions: await db.utilityDistributions.toArray(),
      config: await db.config.toArray(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `joda-parfums-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('¿Sobrescribir todos los datos con el backup? Esta acción no se puede deshacer.')) return
    const text = await file.text()
    const data = JSON.parse(text)

    if (data.accounts) { await db.accounts.clear(); await db.accounts.bulkAdd(data.accounts) }
    if (data.movements) { await db.movements.clear(); await db.movements.bulkAdd(data.movements) }
    if (data.products) { await db.products.clear(); await db.products.bulkAdd(data.products) }
    if (data.stockEntries) { await db.stockEntries.clear(); await db.stockEntries.bulkAdd(data.stockEntries) }
    if (data.supplies) { await db.supplies.clear(); await db.supplies.bulkAdd(data.supplies) }
    if (data.decantBatches) { await db.decantBatches.clear(); await db.decantBatches.bulkAdd(data.decantBatches) }
    if (data.sales) { await db.sales.clear(); await db.sales.bulkAdd(data.sales) }
    if (data.saleItems) { await db.saleItems.clear(); await db.saleItems.bulkAdd(data.saleItems) }
    if (data.customers) { await db.customers.clear(); await db.customers.bulkAdd(data.customers) }
    if (data.suppliers) { await db.suppliers.clear(); await db.suppliers.bulkAdd(data.suppliers) }
    if (data.supplierPrices) { await db.supplierPrices.clear(); await db.supplierPrices.bulkAdd(data.supplierPrices) }
    if (data.orders) { await db.orders.clear(); await db.orders.bulkAdd(data.orders) }
    if (data.localOrders) { await db.localOrders.clear(); await db.localOrders.bulkAdd(data.localOrders) }
    if (data.budgets) { await db.budgets.clear(); await db.budgets.bulkAdd(data.budgets) }
    if (data.utilityDistributions) { await db.utilityDistributions.clear(); await db.utilityDistributions.bulkAdd(data.utilityDistributions) }
    if (data.config) { await db.config.clear(); await db.config.bulkAdd(data.config) }
    alert('Backup importado correctamente. Recarga la página.')
  }

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajustes del sistema y gestión de datos" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos del negocio */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Settings size={16} className="text-violet-600" />
              Datos del negocio
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input label="Nombre del negocio" value={businessName} onChange={e => setBusinessName(e.target.value)} />
            <Input label="Teléfono / WhatsApp" value={businessPhone} onChange={e => setBusinessPhone(e.target.value)} />
            <Input label="Dirección / Ciudad" value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} />
            <Button className="w-full" icon={<Save size={15} />} onClick={handleSave}>
              {saved ? '¡Guardado!' : 'Guardar cambios'}
            </Button>
          </CardBody>
        </Card>

        {/* Cotización USD/PYG */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Cotización USD/PYG</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Cotización actual (Gs. por 1 USD)"
              type="number"
              value={usdRate}
              onChange={e => setUsdRate(e.target.value)}
            />
            <div className="bg-violet-50 rounded-lg p-3 text-sm">
              <p className="text-violet-700 font-medium">1 USD = Gs. {parseInt(usdRate).toLocaleString('es-PY')}</p>
              <p className="text-violet-500 text-xs mt-0.5">Usada como cotización por defecto en nuevas compras</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" icon={<RefreshCw size={15} />} onClick={fetchExchangeRate}>
                Actualizar automáticamente
              </Button>
              <Button className="flex-1" icon={<Save size={15} />} onClick={handleSave}>
                Guardar
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Backup */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Backup de datos</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-500">
              Exporta todos tus datos a un archivo JSON para guardar un respaldo manual.
              Podés importarlo en cualquier momento para restaurar el sistema.
            </p>
            <Button className="w-full" variant="secondary" icon={<Download size={15} />} onClick={exportData}>
              Exportar backup JSON
            </Button>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Importar backup</p>
              <label className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors text-sm text-gray-500 hover:text-violet-600">
                <Upload size={15} />
                Seleccionar archivo .json
                <input type="file" accept=".json" className="hidden" onChange={importData} />
              </label>
            </div>
          </CardBody>
        </Card>

        {/* Info del sistema */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Información del sistema</h3>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-gray-500">Versión</span>
              <span className="font-medium text-gray-900">1.0 — Fase 1 MVP</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-gray-500">Almacenamiento</span>
              <span className="font-medium text-gray-900">IndexedDB (local)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-gray-500">Moneda principal</span>
              <span className="font-medium text-gray-900">Guaraní Paraguayo (PYG)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Módulos activos</span>
              <span className="font-medium text-gray-900">10 módulos</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
