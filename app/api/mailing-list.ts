import { verifyAsync } from '@noble/ed25519'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PublicKey } from '@solana/web3.js'

/**
 * Service client without generated `Database` types (mailing_list_signups lives only in SQL).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generic when schema not codegen'd
type ServiceDb = SupabaseClient<any, 'public', any>

/** Keep in sync with app/src/config/platformOwner.ts */
const DEFAULT_PLATFORM_OWNER =
  '5m9EpMNkFn13PSFBAmQB16wjBSWnfRKMFPBkEYod5REW'

const MAIL_LIST_ADMIN_MSG_RE =
  /^SnapCinema:mailing-list-admin:v1:([^:]+):(\d+):([0-9a-f-]{36})$/i

const MAX_EMAIL_LEN = 320
const MAX_TELEGRAM_LEN = 128
const LIST_LIMIT = 2000

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
}

function getJsonBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    return b as Record<string, unknown>
  }
  if (typeof b === 'string') {
    try {
      return JSON.parse(b || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function getPlatformOwnerPubkeyString(): string {
  return (
    process.env.PLATFORM_OWNER_PUBKEY?.trim() ||
    process.env.VITE_PLATFORM_OWNER_PUBKEY?.trim() ||
    DEFAULT_PLATFORM_OWNER
  )
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !serviceKey) {
    res.status(503).json({
      error: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    })
    return
  }

  const supabase: ServiceDb = createClient(supabaseUrl, serviceKey)
  const body = getJsonBody(req)

  if (body.op === 'list') {
    await handleList(res, supabase, body)
    return
  }

  await handleSignup(res, supabase, body)
}

async function handleSignup(
  res: VercelResponse,
  supabase: ServiceDb,
  body: Record<string, unknown>,
) {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const rawTelegram =
    typeof body.telegram === 'string' ? body.telegram.trim() : ''
  const telegram = rawTelegram.replace(/^@+/, '')

  const intent = body.intent === 'watch' || body.intent === 'contribute' ? body.intent : null
  const source =
    body.source === 'landing' || body.source === 'watch' ? body.source : null

  if (!intent || !source) {
    res.status(400).json({
      error: 'intent (watch|contribute) and source (landing|watch) are required',
    })
    return
  }

  if (email.length === 0 && telegram.length === 0) {
    res.status(400).json({
      error: 'Provide at least one of email or Telegram',
    })
    return
  }

  if (email.length > MAX_EMAIL_LEN || telegram.length > MAX_TELEGRAM_LEN) {
    res.status(400).json({ error: 'Field too long' })
    return
  }

  const row = {
    email: email.length > 0 ? email : null,
    telegram: telegram.length > 0 ? telegram : null,
    intent,
    source,
  }

  const { error } = await supabase.from('mailing_list_signups').insert(row)

  if (error) {
    console.error('[mailing-list] insert', error)
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ ok: true })
}

async function handleList(
  res: VercelResponse,
  supabase: ServiceDb,
  body: Record<string, unknown>,
) {
  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  const message = typeof body.message === 'string' ? body.message : ''
  const sigB64 = typeof body.signature === 'string' ? body.signature : ''
  if (!wallet || !message || !sigB64) {
    res.status(400).json({ error: 'wallet, message, signature required' })
    return
  }

  const m = MAIL_LIST_ADMIN_MSG_RE.exec(message)
  if (!m) {
    res.status(400).json({ error: 'Invalid message format' })
    return
  }
  const msgWallet = m[1]
  const ts = Number(m[2])
  if (msgWallet !== wallet) {
    res.status(400).json({ error: 'Wallet mismatch' })
    return
  }
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 15 * 60_000) {
    res.status(400).json({ error: 'Stale or invalid timestamp' })
    return
  }

  let walletPk: PublicKey
  try {
    walletPk = new PublicKey(wallet)
  } catch {
    res.status(400).json({ error: 'Invalid wallet' })
    return
  }

  let sig: Uint8Array
  try {
    sig = new Uint8Array(Buffer.from(sigB64, 'base64'))
  } catch {
    res.status(400).json({ error: 'Invalid signature encoding' })
    return
  }
  if (sig.length !== 64) {
    res.status(400).json({ error: 'Invalid signature length' })
    return
  }

  const msgBytes = Buffer.from(message, 'utf8')
  const sigOk = await verifyAsync(sig, msgBytes, walletPk.toBytes())
  if (!sigOk) {
    res.status(401).json({ error: 'Signature verification failed' })
    return
  }

  const ownerStr = getPlatformOwnerPubkeyString()
  let ownerPk: PublicKey
  try {
    ownerPk = new PublicKey(ownerStr)
  } catch {
    res.status(500).json({ error: 'Invalid platform owner configuration' })
    return
  }
  if (!walletPk.equals(ownerPk)) {
    res.status(403).json({ error: 'Not platform owner' })
    return
  }

  const { count, error: countErr } = await supabase
    .from('mailing_list_signups')
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    console.error('[mailing-list] count', countErr)
    res.status(500).json({ error: countErr.message })
    return
  }

  const { data: rows, error: listErr } = await supabase
    .from('mailing_list_signups')
    .select('id, email, telegram, intent, source, created_at')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)

  if (listErr) {
    console.error('[mailing-list] list', listErr)
    res.status(500).json({ error: listErr.message })
    return
  }

  res.status(200).json({
    total: count ?? 0,
    rows: rows ?? [],
  })
}
