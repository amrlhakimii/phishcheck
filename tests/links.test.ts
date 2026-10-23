import { describe, expect, it } from 'vitest'
import { analyseLink, claimedHostFromText, extractLinks, inetAton, parseUrl } from '../src/links'
import { scanHtml } from '../src/html'

describe('URL parsing', () => {
  it('detects IP hosts in plain, decimal, hex and octal form', () => {
    expect(parseUrl('http://203.0.113.9/x')).toMatchObject({ hostKind: 'ip' })
    expect(parseUrl('http://3405803785/x')).toMatchObject({ hostKind: 'ip-decimal', ipNormalized: '203.0.113.9' })
    expect(parseUrl('http://0xCB007109/x')).toMatchObject({ hostKind: 'ip-hex', ipNormalized: '203.0.113.9' })
    expect(parseUrl('http://0313.0.0161.011/x')).toMatchObject({ hostKind: 'ip-octal', ipNormalized: '203.0.113.9' })
    expect(parseUrl('http://[2001:db8::1]/x')).toMatchObject({ hostKind: 'ipv6' })
    expect(parseUrl('http://example.com/x')).toMatchObject({ hostKind: 'domain' })
    expect(inetAton('999.1.1.1')).toBeNull()
  })
  it('extracts the real host after userinfo @', () => {
    const u = parseUrl('https://www.bank.example.com@evil.test/login')
    expect(u?.host).toBe('evil.test')
    expect(u?.userinfo).toBe('www.bank.example.com')
  })
  it('handles backslashes, whitespace and odd schemes', () => {
    expect(parseUrl('https:\\\\evil.test\\x')?.host).toBe('evil.test')
    expect(parseUrl('  http://exa\tmple.test/ ')?.host).toBe('example.test')
    expect(parseUrl('javascript:alert(1)')?.scheme).toBe('javascript')
    expect(parseUrl('not a url')).toBeNull()
  })
})

describe('link analysis flags', () => {
  const flags = (href: string, text = '') => analyseLink(href, text, 'html').flags
  it('flags text vs href mismatch and defangs', () => {
    const l = analyseLink('http://evil.test/login', 'www.bank.com', 'html')
    expect(l.flags).toContain('text-mismatch')
    expect(l.defanged).toBe('hxxp[://]evil[.]test/login')
    expect(l.defanged).not.toMatch(/http/)
  })
  it('does not flag matching or same-organisation text', () => {
    expect(flags('https://www.example.com/a', 'www.example.com')).not.toContain('text-mismatch')
    expect(flags('https://click.mail.example.com/r/1', 'https://www.example.com/sale')).not.toContain('text-mismatch')
    expect(flags('https://example.com/unsub', 'Unsubscribe')).not.toContain('text-mismatch')
    expect(flags('https://example.com/report', 'report.pdf')).not.toContain('text-mismatch')
  })
  it('flags text naming a domain but linking to an IP', () => {
    expect(flags('http://203.0.113.9/x', 'https://bank.example.com')).toContain('text-mismatch')
  })
  it('flags userinfo @ obfuscation', () => {
    expect(flags('https://www.example.com@evil.test/')).toContain('userinfo')
  })
  it('flags IP, obfuscated IP, http, shortener, data/javascript, long/encoded', () => {
    expect(flags('http://203.0.113.9/')).toEqual(expect.arrayContaining(['ip-host', 'http']))
    expect(flags('https://3405803785/')).toContain('ip-obfuscated')
    expect(flags('https://0xCB007109/')).toContain('ip-obfuscated')
    expect(flags('https://bit.ly/abc')).toContain('shortener')
    expect(flags('javascript:alert(1)')).toContain('javascript-url')
    expect(flags('data:text/html;base64,PHNjcmlwdD4=')).toContain('data-url')
    expect(flags('https://example.com/' + 'a'.repeat(250))).toContain('long-url')
    expect(flags('https://example.com/' + '%41'.repeat(12))).toContain('encoded')
  })
  it('keeps ordinary https links clean', () => {
    expect(flags('https://www.example.com/page?id=1', 'Read more')).toEqual([])
  })
  it('flags lookalike and punycode hosts', () => {
    expect(flags('https://paypa1.com/login')).toContain('lookalike')
    expect(flags('https://xn--pypal-4ve.com/')).toEqual(expect.arrayContaining(['punycode', 'lookalike']))
    expect(flags('https://www.paypal.com/signin')).not.toContain('lookalike')
  })
  it('reads claimed hosts from anchor text', () => {
    expect(claimedHostFromText('Go to www.bank.com now')).toBe('www.bank.com')
    expect(claimedHostFromText('https://login.microsoft.com/x')).toBe('login.microsoft.com')
    expect(claimedHostFromText('Click here')).toBeUndefined()
    expect(claimedHostFromText('e.g. this')).toBeUndefined()
  })
})

describe('link extraction', () => {
  it('extracts html anchors and bare text urls without duplicating', () => {
    const links = extractLinks('See https://a.example.com/x. Also www.b.example.com', '<a href="https://a.example.com/x">here</a>')
    expect(links.map((l) => l.href)).toEqual(['https://a.example.com/x', 'http://www.b.example.com'])
  })
  it('handles anchors with nested markup and entities', () => {
    const links = extractLinks('', '<a href="https://evil.test/?a=1&amp;b=2"><b>www.</b><span>bank.com</span></a>')
    expect(links[0].href).toBe('https://evil.test/?a=1&b=2')
    expect(links[0].text).toBe('www.bank.com')
    expect(links[0].flags).toContain('text-mismatch')
  })
})

describe('html scanner', () => {
  it('detects tracking pixels, hidden text and scripts without executing anything', () => {
    const f = scanHtml('<p>Hi</p><img src="http://t.example.test/p.gif" width=1 height=1><div style="font-size:0">secret words</div><script>alert(1)</script><span style="display:none">x</span>')
    expect(f.images).toHaveLength(1)
    expect(f.hiddenText.join(' ')).toContain('secret words')
    expect(f.hasScript).toBe(true)
    expect(f.text).toBe('Hi')
    expect(f.text).not.toContain('alert')
  })
  it('does not choke on malformed html', () => {
    const f = scanHtml('<a href="x<<<<<<<<<<<<<<<<' + '<div '.repeat(50_000))
    expect(f).toBeTruthy()
  })
})
