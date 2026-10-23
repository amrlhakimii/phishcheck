import { LIMITS } from './limits'
import { decodeEncodedWords } from './decode'

export interface Header {
  name: string
  /** Lower-cased name for lookups. */
  key: string
  /** Unfolded raw value. */
  raw: string
  /** Value with RFC 2047 encoded-words decoded. */
  value: string
}

export function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n')
}

/** Split an entity into header block and body at the first blank line. */
export function splitHeadBody(text: string): { head: string; body: string } {
  const t = normalizeNewlines(text)
  if (t.startsWith('\n')) return { head: '', body: t.slice(1) }
  const idx = t.indexOf('\n\n')
  if (idx < 0) return { head: t, body: '' }
  return { head: t.slice(0, idx), body: t.slice(idx + 2) }
}

/** Parse a header block (already newline-normalised or not). Handles folded lines and duplicates. */
export function parseHeaders(head: string): Header[] {
  const lines = normalizeNewlines(head.length > LIMITS.maxHeaderBlock ? head.slice(0, LIMITS.maxHeaderBlock) : head).split('\n')
  const headers: Header[] = []
  let cur: { name: string; raw: string } | null = null
  const flush = () => {
    if (!cur) return
    const raw = cur.raw.trim()
    headers.push({ name: cur.name, key: cur.name.toLowerCase(), raw, value: decodeEncodedWords(raw) })
    cur = null
  }
  for (const line of lines) {
    if (headers.length >= LIMITS.maxHeaders) break
    if (/^[ \t]/.test(line)) {
      if (cur) (cur as { raw: string }).raw += ' ' + line.trim()
      continue
    }
    if (line.startsWith('>From ') || /^From \S/.test(line)) continue // mbox "From " line
    const colon = line.indexOf(':')
    if (colon > 0 && /^[\x21-\x39\x3b-\x7e]+$/.test(line.slice(0, colon))) {
      flush()
      cur = { name: line.slice(0, colon), raw: line.slice(colon + 1) }
    } else if (line.trim() === '') {
      continue
    } else {
      flush()
    }
  }
  flush()
  return headers
}

export function getAll(headers: Header[], name: string): Header[] {
  const k = name.toLowerCase()
  return headers.filter((h) => h.key === k)
}

export function getFirst(headers: Header[], name: string): Header | undefined {
  const k = name.toLowerCase()
  return headers.find((h) => h.key === k)
}

// ---------- Addresses ----------
export interface Address {
  display: string
  address: string
  local: string
  domain: string
}

/** Parse the first mailbox out of a header value ("Name" <a@b.c>, a@b.c, or Name <a@b.c>). */
export function parseAddress(value: string): Address | null {
  const v = value.trim()
  if (!v) return null
  const lt = v.lastIndexOf('<')
  const gt = lt >= 0 ? v.indexOf('>', lt) : -1
  let display = ''
  let addr: string
  if (lt >= 0 && gt > lt) {
    addr = v.slice(lt + 1, gt).trim()
    display = v.slice(0, lt).trim()
  } else {
    // bare address, maybe with a (comment)
    const bare = v.replace(/\([^()]*\)/g, ' ').trim().split(/[\s,;]+/)[0] ?? ''
    addr = bare
    if (!addr.includes('@')) return v.includes('@') ? null : { display: v, address: '', local: '', domain: '' }
  }
  display = display.replace(/^"(.*)"$/, '$1').replace(/\\(.)/g, '$1').trim()
  const at = addr.lastIndexOf('@')
  if (at < 1) return { display, address: addr, local: addr, domain: '' }
  const domain = addr.slice(at + 1).trim().toLowerCase().replace(/[>\s]+$/, '')
  return { display, address: addr, local: addr.slice(0, at), domain }
}

// ---------- Parameters (Content-Type, Content-Disposition) ----------
export interface ParamHeader {
  value: string
  params: Record<string, string>
}

export function parseParamHeader(raw: string): ParamHeader {
  const parts: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '"' && raw[i - 1] !== '\\') inQ = !inQ
    if (c === ';' && !inQ) { parts.push(cur); cur = '' } else cur += c
  }
  parts.push(cur)
  const params: Record<string, string> = {}
  const cont: Record<string, string[]> = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=')
    if (eq < 0) continue
    const k = p.slice(0, eq).trim().toLowerCase()
    let v = p.slice(eq + 1).trim()
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1).replace(/\\(.)/g, '$1')
    const m = /^([^*]+)\*(\d+)\*?$/.exec(k)
    if (m) {
      ;(cont[m[1]] ??= [])[Number(m[2])] = v
    } else if (k.endsWith('*')) {
      const base = k.slice(0, -1)
      const mm = /^([^']*)'[^']*'(.*)$/.exec(v)
      try {
        params[base] = mm ? decodeURIComponent(mm[2]) : v
      } catch {
        params[base] = v
      }
    } else params[k] = decodeEncodedWords(v)
  }
  for (const [k, arr] of Object.entries(cont)) params[k] = arr.join('')
  return { value: (parts[0] ?? '').trim().toLowerCase(), params }
}
