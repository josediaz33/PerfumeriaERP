import { db } from '../db/db'
import { nowISO } from './format'

export async function upsertCustomer(
  name: string,
  phone?: string,
  address?: string,
): Promise<number | undefined> {
  const normalName = name.trim()
  if (!normalName) return undefined

  // Match by phone first — most reliable unique identifier
  if (phone?.trim()) {
    const byPhone = await db.customers.filter(c => c.phone === phone.trim()).first()
    if (byPhone) {
      const updates: Record<string, string> = {}
      if (address?.trim() && !byPhone.address) updates.address = address.trim()
      if (Object.keys(updates).length > 0) await db.customers.update(byPhone.id!, updates)
      return byPhone.id
    }
  }

  // Match by name (case insensitive)
  const all = await db.customers.toArray()
  const byName = all.find(c => c.name.toLowerCase() === normalName.toLowerCase())
  if (byName) {
    const updates: Record<string, string> = {}
    if (phone?.trim() && !byName.phone) updates.phone = phone.trim()
    if (address?.trim() && !byName.address) updates.address = address.trim()
    if (Object.keys(updates).length > 0) await db.customers.update(byName.id!, updates)
    return byName.id
  }

  // New customer
  const id = await db.customers.add({
    name: normalName,
    phone: phone?.trim() || undefined,
    address: address?.trim() || undefined,
    createdAt: nowISO(),
  })
  return id as number
}
