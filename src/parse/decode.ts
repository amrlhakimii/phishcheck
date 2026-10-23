/** Content-transfer and charset decoding. All functions are total: malformed input never throws. */

export function bytesToString(bytes: Uint8Array, charset?: string): string {
  const cs = (charset ?? 'utf-8').trim().toLowerCase().replace(/^"|"$/g, '')
  const name = cs === 'us-ascii' || cs === 'ascii' ? 'utf-8' : cs
  try {
    return new TextDecoder(name, { fatal: false }).decode(bytes)
  } catch {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    } catch {
      let s = ''
      for (const b of bytes) s += String.fromCharCode(b)
      return s
    }
  }
}

export function stringToLatin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

function hexVal(c: number): number {
  if (c >= 48 && c <= 57) return c - 48
  if (c >= 65 && c <= 70) return c - 55
  if (c >= 97 && c <= 102) return c - 87
  return -1
}

/**
 * Decode quoted-printable (RFC 2045). `headerMode` is the RFC 2047 "Q" variant where "_" is a space
 * and soft line breaks do not exist. Invalid escapes are kept literally.
 */
export function decodeQuotedPrintable(input: string, headerMode = false, maxBytes = Infinity): Uint8Array {
  const out: number[] = []
  const n = input.length
  let i = 0
  while (i < n && out.length < maxBytes) {
    const c = input.charCodeAt(i)
    if (c === 61 /* = */) {
      if (!headerMode) {
        // soft line break: "=" + optional trailing whitespace + newline
        let j = i + 1
        while (j < n && (input[j] === ' ' || input[j] === '\t')) j++
        if (input[j] === '\r' && input[j + 1] === '\n') { i = j + 2; continue }
        if (input[j] === '\n' || input[j] === '\r') { i = j + 1; continue }
        if (j >= n) { i = n; continue }
      }
      const h = hexVal(input.charCodeAt(i + 1))
      const l = hexVal(input.charCodeAt(i + 2))
      if (h >= 0 && l >= 0) {
        out.push((h << 4) | l)
        i += 3
        continue
      }
      out.push(61)
      i++
    } else if (headerMode && c === 95) {
      out.push(32)
      i++
    } else if (c > 255) {
      // Already-decoded unicode inside a QP body: encode as UTF-8.
      const cp = input.codePointAt(i) as number
      const enc = new TextEncoder().encode(String.fromCodePoint(cp))
      for (const b of enc) out.push(b)
      i += cp > 0xffff ? 2 : 1
    } else {
      out.push(c)
      i++
    }
  }
  return Uint8Array.from(out)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_LOOKUP: Int16Array = (() => {
  const t = new Int16Array(256).fill(-1)
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i
  t[45] = 62 // url-safe '-'
  t[95] = 63 // url-safe '_'
  return t
})()

/** Lenient base64: ignores whitespace and invalid characters, tolerates missing padding. */
export function decodeBase64(input: string, maxBytes = Infinity): Uint8Array {
  const out: number[] = []
  let acc = 0
  let bits = 0
  for (let i = 0; i < input.length && out.length < maxBytes; i++) {
    const c = input.charCodeAt(i)
    if (c === 61) break
    const v = c < 256 ? B64_LOOKUP[c] : -1
    if (v < 0) continue
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((acc >> bits) & 0xff)
      acc &= (1 << bits) - 1
    }
  }
  return Uint8Array.from(out)
}

/**
 * Decode RFC 2047 encoded-words ("=?UTF-8?B?...?=") inside a header value.
 * Whitespace between adjacent encoded words is dropped, per the RFC.
 */
export function decodeEncodedWords(value: string): string {
  if (!value.includes('=?')) return value
  let out = ''
  let i = 0
  let lastWasEncoded = false
  const n = value.length
  while (i < n) {
    const start = value.indexOf('=?', i)
    if (start < 0) { out += value.slice(i); break }
    const between = value.slice(i, start)
    const parsed = parseEncodedWord(value, start)
    if (!parsed) {
      out += between + '=?'
      i = start + 2
      lastWasEncoded = false
      continue
    }
    if (!(lastWasEncoded && /^\s*$/.test(between))) out += between
    out += parsed.text
    i = parsed.end
    lastWasEncoded = true
  }
  return out
}

function parseEncodedWord(s: string, start: number): { text: string; end: number } | null {
  // =?charset?enc?text?=  (indexOf based, linear)
  const q1 = s.indexOf('?', start + 2)
  if (q1 < 0) return null
  const q2 = s.indexOf('?', q1 + 1)
  if (q2 < 0 || q2 !== q1 + 2) return null
  const q3 = s.indexOf('?=', q2 + 1)
  if (q3 < 0) return null
  const charset = s.slice(start + 2, q1).split('*')[0]
  const enc = s[q1 + 1].toUpperCase()
  const text = s.slice(q2 + 1, q3)
  if (charset.length === 0 || charset.length > 40 || /\s/.test(charset) || /\s/.test(text)) return null
  let bytes: Uint8Array
  if (enc === 'B') bytes = decodeBase64(text, 8192)
  else if (enc === 'Q') bytes = decodeQuotedPrintable(text, true, 8192)
  else return null
  return { text: bytesToString(bytes, charset), end: q3 + 2 }
}
