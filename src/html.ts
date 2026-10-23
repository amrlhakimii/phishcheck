/**
 * A tiny, inert HTML scanner. It never builds a DOM, never executes anything and never loads
 * resources: it only walks the source text once and records facts (links, images, hidden text).
 * Hand-written scanning (indexOf + char loops) keeps it linear-time.
 */
import { LIMITS } from './parse/limits'

export interface HtmlLink {
  href: string
  text: string
}
export interface HtmlImage {
  src: string
  width: string
  height: string
  hidden: boolean
}
export interface HtmlFacts {
  links: HtmlLink[]
  images: HtmlImage[]
  hiddenText: string[]
  /** Visible-ish text, tags stripped and entities decoded. */
  text: string
  hasScript: boolean
  hasForm: boolean
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', hellip: '…', ndash: '–', mdash: '—' }

export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, body: string) => {
    if (body[0] === '#') {
      const cp = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      if (!Number.isFinite(cp) || cp < 1 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return ''
      return String.fromCodePoint(cp)
    }
    return ENTITIES[body.toLowerCase()] ?? m
  })
}

const VOID = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'])
const BLOCK = new Set(['p', 'div', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'ul', 'ol', 'blockquote', 'section', 'hr'])

interface Tag {
  name: string
  closing: boolean
  selfClosing: boolean
  attrs: Record<string, string>
  end: number
}

function isSpace(c: string): boolean {
  return c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f'
}

function parseTag(src: string, start: number): Tag | null {
  const n = src.length
  let i = start + 1
  let closing = false
  if (src[i] === '/') { closing = true; i++ }
  let name = ''
  while (i < n && /[A-Za-z0-9:-]/.test(src[i]) && name.length < 32) name += src[i++]
  if (!name) return null
  name = name.toLowerCase()
  const attrs: Record<string, string> = {}
  let selfClosing = false
  let count = 0
  while (i < n) {
    while (i < n && isSpace(src[i])) i++
    if (i >= n) return { name, closing, selfClosing, attrs, end: n }
    if (src[i] === '>') return { name, closing, selfClosing, attrs, end: i + 1 }
    if (src[i] === '/') { selfClosing = true; i++; continue }
    let an = ''
    while (i < n && !isSpace(src[i]) && src[i] !== '=' && src[i] !== '>' && src[i] !== '/' && an.length < 40) an += src[i++]
    if (!an) { i++; continue }
    an = an.toLowerCase()
    while (i < n && isSpace(src[i])) i++
    let val = ''
    if (src[i] === '=') {
      i++
      while (i < n && isSpace(src[i])) i++
      const q = src[i]
      if (q === '"' || q === "'") {
        const close = src.indexOf(q, i + 1)
        const stop = close < 0 ? n : close
        val = src.slice(i + 1, Math.min(stop, i + 1 + 8192))
        i = close < 0 ? n : close + 1
      } else {
        const s = i
        while (i < n && !isSpace(src[i]) && src[i] !== '>') i++
        val = src.slice(s, Math.min(i, s + 8192))
      }
    }
    if (++count <= 40 && !(an in attrs)) attrs[an] = decodeEntities(val)
  }
  return { name, closing, selfClosing, attrs, end: n }
}

function styleHides(style: string): boolean {
  const s = style.toLowerCase().replace(/\s+/g, '')
  if (!s) return false
  if (/(^|;)font-size:0(px|pt|em|rem|%)?(;|$)/.test(s)) return true
  if (/(^|;)display:none(;|$)/.test(s)) return true
  if (/(^|;)visibility:hidden(;|$)/.test(s)) return true
  if (/(^|;)opacity:0(\.0+)?(;|$)/.test(s)) return true
  if (/(^|;)max-height:0(px)?(;|$)/.test(s) && /overflow:hidden/.test(s)) return true
  const color = /(?:^|;)color:(#fff(?:fff)?|white|rgb\(255,255,255\))(?:;|$)/.exec(s)
  const bg = /background(?:-color)?:(#fff(?:fff)?|white|rgb\(255,255,255\))(?:;|$)/.exec(s)
  return !!(color && bg)
}

function findClose(src: string, name: string, from: number): number {
  let j = src.indexOf('</', from)
  while (j >= 0) {
    if (src.slice(j + 2, j + 2 + name.length).toLowerCase() === name) return j
    j = src.indexOf('</', j + 2)
  }
  return -1
}

export function scanHtml(src: string): HtmlFacts {
  const facts: HtmlFacts = { links: [], images: [], hiddenText: [], text: '', hasScript: false, hasForm: false }
  const n = src.length
  let i = 0
  const out: string[] = []
  const stack: { name: string; hidden: boolean }[] = []
  let anchor: { href: string; text: string[] } | null = null
  let hiddenBuf = ''
  const isHidden = () => stack.some((s) => s.hidden)

  while (i < n) {
    const lt = src.indexOf('<', i)
    const textEnd = lt < 0 ? n : lt
    if (textEnd > i) {
      const t = decodeEntities(src.slice(i, textEnd))
      if (isHidden()) hiddenBuf += t
      else {
        out.push(t)
        if (anchor) anchor.text.push(t)
      }
    }
    if (lt < 0) break
    // comments
    if (src.startsWith('<!--', lt)) {
      const e = src.indexOf('-->', lt + 4)
      i = e < 0 ? n : e + 3
      continue
    }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') {
      const e = src.indexOf('>', lt)
      i = e < 0 ? n : e + 1
      continue
    }
    const tag = parseTag(src, lt)
    if (!tag) {
      out.push('<')
      i = lt + 1
      continue
    }
    i = tag.end
    if (!tag.closing && (tag.name === 'script' || tag.name === 'style')) {
      if (tag.name === 'script') facts.hasScript = true
      const close = findClose(src, tag.name, i)
      const e = close < 0 ? n : src.indexOf('>', close)
      i = e < 0 ? n : e + 1
      continue
    }
    if (tag.name === 'form' && !tag.closing) facts.hasForm = true
    if (tag.closing) {
      // pop to matching tag
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].name === tag.name) { stack.length = k; break }
      }
      if (tag.name === 'a' && anchor) {
        facts.links.push({ href: anchor.href, text: anchor.text.join('').replace(/\s+/g, ' ').trim() })
        anchor = null
      }
      if (BLOCK.has(tag.name)) out.push('\n')
      if (!isHidden() && hiddenBuf.trim()) { facts.hiddenText.push(hiddenBuf.trim().slice(0, 200)); hiddenBuf = '' }
      continue
    }
    if (BLOCK.has(tag.name)) out.push('\n')
    const hid = styleHides(tag.attrs['style'] ?? '') || 'hidden' in tag.attrs
    if (tag.name === 'img') {
      facts.images.push({
        src: tag.attrs['src'] ?? '',
        width: (tag.attrs['width'] ?? '').trim(),
        height: (tag.attrs['height'] ?? '').trim(),
        hidden: hid || isHidden(),
      })
      const alt = tag.attrs['alt']
      if (alt && anchor) anchor.text.push(alt)
    }
    if (tag.name === 'a' && tag.attrs['href'] !== undefined && !anchor) {
      anchor = { href: tag.attrs['href'].trim(), text: [] }
    }
    if (tag.name === 'area' && tag.attrs['href']) facts.links.push({ href: tag.attrs['href'].trim(), text: tag.attrs['alt'] ?? '' })
    if (!VOID.has(tag.name) && !tag.selfClosing && stack.length < LIMITS.maxHtmlDepth) {
      stack.push({ name: tag.name, hidden: hid })
    }
    if (facts.links.length >= LIMITS.maxLinks) break
  }
  if (anchor) facts.links.push({ href: anchor.href, text: anchor.text.join('').replace(/\s+/g, ' ').trim() })
  if (hiddenBuf.trim()) facts.hiddenText.push(hiddenBuf.trim().slice(0, 200))
  facts.text = out.join('').replace(/[ \t\f]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return facts
}
