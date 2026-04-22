/**
 * Vercel + Supabase integration often sets `NEXT_PUBLIC_*` and `*_PUBLISHABLE_KEY`;
 * this app historically used `VITE_*` and `*_ANON_KEY`. We accept both. Some
 * integration presets only expose `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`
 * (no prefix); those are checked via `process.env` (e.g. `vercel dev` / server).
 * For a production Vite build, the publishable/anon value must also exist as
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` so
 * the browser bundle can read it.
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
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
  ])
}

export function supabaseClientConfigured(): boolean {
  return Boolean(
    supabaseUrlForClient()?.trim() && supabaseAnonKeyForClient()?.trim(),
  )
}
