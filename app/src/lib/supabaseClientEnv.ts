/**
 * Vercel + Supabase integration often sets `NEXT_PUBLIC_*` and `*_PUBLISHABLE_KEY`;
 * this app historically used `VITE_*` and `*_ANON_KEY`. We accept both.
 */
function getImportMetaEnv(): Record<string, string> | undefined {
  return typeof import.meta !== 'undefined'
    ? (import.meta as ImportMeta & { env?: Record<string, string> }).env
    : undefined
}

function firstDefined(names: string[]): string | undefined {
  const im = getImportMetaEnv()
  for (const name of names) {
    const fromVite = im?.[name]
    if (fromVite != null && String(fromVite).trim() !== '') {
      return String(fromVite)
    }
  }
  if (typeof process !== 'undefined') {
    for (const name of names) {
      const p = process.env[name]
      if (p != null && String(p).trim() !== '') return String(p)
    }
  }
  return undefined
}

export function supabaseUrlForClient(): string | undefined {
  return firstDefined(['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'])
}

export function supabaseAnonKeyForClient(): string | undefined {
  return firstDefined([
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ])
}

export function supabaseClientConfigured(): boolean {
  return Boolean(
    supabaseUrlForClient()?.trim() && supabaseAnonKeyForClient()?.trim(),
  )
}
