import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const SRC = walk('src').filter((f) => /\.(ts|tsx)$/.test(f))

describe('static security rules', () => {
  it('never uses dangerous DOM sinks or embedded content', () => {
    for (const f of SRC) {
      const code = readFileSync(f, 'utf8')
      expect(code, f).not.toMatch(/dangerouslySetInnerHTML|innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(|<iframe|<object|<embed|DOMParser/)
    }
  })
  it('only doh.ts performs network calls', () => {
    for (const f of SRC) {
      if (f.endsWith('doh.ts')) continue
      const code = readFileSync(f, 'utf8')
      expect(code, f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|new Image\(|window\.open|location\.(href|assign|replace)\s*=/)
    }
  })
  it('never renders an email-derived href', () => {
    for (const f of SRC.filter((x) => x.includes('/ui/') || x.endsWith('App.tsx'))) {
      const code = readFileSync(f, 'utf8')
      for (const m of code.matchAll(/href=\{?([^\s>]+)/g)) expect(m[1], f).toMatch(/^["']\/["']$|^\{?"\/"/)
    }
  })
  it('ships a strict _headers file', () => {
    const h = readFileSync('public/_headers', 'utf8')
    expect(h).toContain("default-src 'self'")
    expect(h).toContain("img-src 'self' data:")
    expect(h).toMatch(/connect-src https:\/\/cloudflare-dns\.com(;|\s|$)/)
    expect(h).toContain('X-Content-Type-Options: nosniff')
    expect(h).toContain('Referrer-Policy: no-referrer')
    expect(h).not.toMatch(/unsafe-inline|unsafe-eval|\*\./)
    expect(h).not.toMatch(/fonts\.(googleapis|gstatic)/)
  })
  it('contains no "AI-powered" claims in UI or docs', () => {
    for (const f of [...SRC, 'README.md', 'index.html']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/AI[- ]powered|machine learning detect/i)
    }
  })
})
