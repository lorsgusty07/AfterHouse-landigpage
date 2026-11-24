const DEFAULT_DB_URL = 'https://yapev2-default-rtdb.firebaseio.com'

function buildUrl(path: string): string {
  const base = (process.env.FIREBASE_DATABASE_URL || DEFAULT_DB_URL).replace(/\/+$/, '')
  const secret = process.env.FIREBASE_DATABASE_SECRET?.trim()
  if (!secret) {
    throw new Error('FIREBASE_DATABASE_SECRET no está configurado en el archivo .env')
  }
  const cleanPath = path.replace(/^\/+/, '').replace(/\.json$/, '')
  return `${base}/${cleanPath}.json?auth=${encodeURIComponent(secret)}`
}

export async function rtdbGet<T>(path: string): Promise<T | null> {
  const res = await fetch(buildUrl(path), { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Firebase GET ${path} falló (${res.status}): ${text}`)
  }
  return (await res.json()) as T | null
}

export async function rtdbPost<T extends object>(path: string, data: T): Promise<{ name: string }> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Firebase POST ${path} falló (${res.status}): ${text}`)
  }
  return (await res.json()) as { name: string }
}

export async function rtdbPatch(path: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Firebase PATCH ${path} falló (${res.status}): ${text}`)
  }
}

export async function rtdbPut<T>(path: string, data: T): Promise<void> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Firebase PUT ${path} falló (${res.status}): ${text}`)
  }
}

