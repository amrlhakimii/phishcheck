import { describe, expect, it } from 'vitest'
import { decodeBase64, decodeEncodedWords, decodeQuotedPrintable, bytesToString } from '../src/parse/decode'
import { getAll, getFirst, parseAddress, parseHeaders, parseParamHeader, splitHeadBody } from '../src/parse/headers'

describe('decoders', () => {
  it('decodes base64 leniently', () => {
    expect(bytesToString(decodeBase64('SGVsbG8s\nIHdvcmxk'))).toBe('Hello, world')
    expect(bytesToString(decodeBase64('SGVsbG8'))).toBe('Hello') // missing padding
    expect(bytesToString(decodeBase64('SGV$$sbG8='))).toBe('Hello') // junk chars ignored
  })
  it('decodes quoted-printable incl. soft breaks and UTF-8', () => {
    expect(bytesToString(decodeQuotedPrintable('caf=C3=A9 and long=\nline'))).toBe('café and longline')
    expect(bytesToString(decodeQuotedPrintable('a=3Db'))).toBe('a=b')
  })
  it('keeps malformed QP escapes literally instead of throwing', () => {
    expect(bytesToString(decodeQuotedPrintable('100=ZZ%'))).toBe('100=ZZ%')
    expect(bytesToString(decodeQuotedPrintable('trailing='))).toBe('trailing')
  })
  it('falls back safely on unknown charsets', () => {
    expect(bytesToString(new TextEncoder().encode('ok'), 'x-not-a-charset')).toBe('ok')
  })
  it('decodes encoded-word B and Q, joins adjacent words', () => {
    expect(decodeEncodedWords('=?UTF-8?B?SGVsbG8g8J+RiyE=?=')).toBe('Hello 👋!')
    expect(decodeEncodedWords('=?UTF-8?Q?caf=C3=A9_au_lait?=')).toBe('café au lait')
    expect(decodeEncodedWords('=?UTF-8?Q?foo?= =?UTF-8?Q?bar?=')).toBe('foobar')
    expect(decodeEncodedWords('Re: =?ISO-8859-1?Q?caf=E9?= menu')).toBe('Re: café menu')
  })
  it('leaves malformed encoded-words alone', () => {
    expect(decodeEncodedWords('=?UTF-8?X?abc?=')).toBe('=?UTF-8?X?abc?=')
    expect(decodeEncodedWords('=?broken')).toBe('=?broken')
    expect(decodeEncodedWords('=?=?=?=?=')).toBeTypeOf('string')
  })
})

describe('header parser', () => {
  it('unfolds folded headers (LF and CRLF)', () => {
    for (const nl of ['\n', '\r\n']) {
      const raw = `Subject: one${nl} two${nl}\tthree${nl}From: a@example.com${nl}${nl}body`
      const { head, body } = splitHeadBody(raw)
      const h = parseHeaders(head)
      expect(getFirst(h, 'subject')?.raw).toBe('one two three')
      expect(getFirst(h, 'from')?.raw).toBe('a@example.com')
      expect(body).toBe('body')
    }
  })
  it('keeps duplicate headers in order and is case-insensitive', () => {
    const h = parseHeaders('Received: first\nreceived: second\nRECEIVED: third')
    expect(getAll(h, 'Received').map((x) => x.raw)).toEqual(['first', 'second', 'third'])
  })
  it('decodes encoded-word subjects', () => {
    const h = parseHeaders('Subject: =?UTF-8?B?w6l0w6k=?=')
    expect(getFirst(h, 'subject')?.value).toBe('été')
    expect(getFirst(h, 'subject')?.raw).toContain('=?UTF-8')
  })
  it('ignores garbage lines and mbox From lines', () => {
    const h = parseHeaders('From someone@example.com Sat Oct 24\nthis is not a header\nSubject: ok')
    expect(h.map((x) => x.key)).toEqual(['subject'])
  })
  it('parses addresses with display names and quoting', () => {
    expect(parseAddress('"Doe, Jane" <Jane@Example.COM>')).toMatchObject({ display: 'Doe, Jane', domain: 'example.com', address: 'Jane@Example.COM' })
    expect(parseAddress('bob@example.net')).toMatchObject({ display: '', domain: 'example.net' })
    expect(parseAddress('<bounce@example.org>')).toMatchObject({ domain: 'example.org' })
    expect(parseAddress('')).toBeNull()
  })
  it('parses parameters incl. quoted values and RFC 2231 continuations', () => {
    const p = parseParamHeader('multipart/mixed; boundary="a;b"; charset=utf-8')
    expect(p.value).toBe('multipart/mixed')
    expect(p.params.boundary).toBe('a;b')
    const c = parseParamHeader("attachment; filename*0=\"long\"; filename*1=\"name.txt\"")
    expect(c.params.filename).toBe('longname.txt')
    const e = parseParamHeader("attachment; filename*=UTF-8''caf%C3%A9.txt")
    expect(e.params.filename).toBe('café.txt')
  })
})
