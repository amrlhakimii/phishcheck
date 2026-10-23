import { describe, expect, it } from 'vitest'
import { findLookalike, foldUnicode, hostToUnicode, levenshtein, normalizeLookalike, orgDomain, punycodeDecode, sameOrg, subdomainDepth } from '../src/domain'
import { defangDomain, defangEmail, defangText, defangUrl } from '../src/ioc'

describe('domain helpers', () => {
  it('computes edit distance', () => {
    expect(levenshtein('paypal', 'paypal')).toBe(0)
    expect(levenshtein('paypal', 'paypa1')).toBe(1)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
  })
  it('normalises homoglyphs', () => {
    expect(normalizeLookalike('paypa1')).toBe('paypal')
    expect(normalizeLookalike('rnicrosoft')).toBe('microsoft')
    expect(normalizeLookalike('g00gle')).toBe('google')
    expect(foldUnicode('аррӏе')).toBe('apple') // Cyrillic
    expect(foldUnicode('café')).toBe('cafe')
  })
  it('decodes punycode', () => {
    expect(punycodeDecode('bcher-kva')).toBe('bücher')
    expect(hostToUnicode('xn--bcher-kva.example')).toBe('bücher.example')
    expect(hostToUnicode('xn--###.example')).toBe('xn--###.example')
    expect(punycodeDecode('!!!')).toBeNull()
  })
  it('finds the organisational domain', () => {
    expect(orgDomain('mail.news.example.com')).toBe('example.com')
    expect(orgDomain('www.maybank2u.com.my')).toBe('maybank2u.com.my')
    expect(sameOrg('a.example.com', 'b.example.com')).toBe(true)
    expect(sameOrg('example.com', 'example.net')).toBe(false)
    expect(subdomainDepth('a.b.c.d.example.test')).toBe(4)
  })
})

describe('lookalike detection (positive)', () => {
  it.each([
    ['paypa1.com', 'PayPal'],
    ['rnicrosoft.com', 'Microsoft'],
    ['micros0ft.com', 'Microsoft'],
    ['g00gle.com', 'Google'],
    ['paypal-secure-login.example.test', 'PayPal'],
    ['paypall.com', 'PayPal'],
    ['maybnak.com.my', 'Maybank'],
    ['rnaybank.com', 'Maybank'],
    ['lazad4.com', 'Lazada'],
    ['xn--pypal-4ve.com', 'PayPal'], // pаypal with Cyrillic a
    ['secure.paypal.com.example.test', 'PayPal'],
    ['shopee.example.net', 'Shopee'],
  ])('flags %s as imitating %s', (host, brand) => {
    const hit = findLookalike(host)
    expect(hit, host).not.toBeNull()
    expect(hit?.brand.name).toBe(brand)
  })
  it('flags xn-- homograph with kind idn-homoglyph', () => {
    expect(findLookalike('xn--pypal-4ve.com')?.kind).toBe('idn-homoglyph')
  })
})

describe('lookalike detection (negative)', () => {
  it.each([
    'paypal.com', 'www.paypal.com', 'mail.paypal.com', 'microsoft.com', 'login.microsoftonline.com', 'google.com', 'accounts.google.com',
    'maybank2u.com.my', 'www.maybank2u.com.my', 'cimbclicks.com.my', 'shopee.com.my', 'hasil.gov.my', 'apple.com', 'dhl.com', 'fedex.com',
    'example.com', 'newsletter.example.com', 'example.test', 'github.com', 'wikipedia.org', 'bank.example.net', '203.0.113.5',
  ])('leaves %s clean', (host) => {
    expect(findLookalike(host), host).toBeNull()
  })
})

describe('defanging', () => {
  it('defangs urls, domains, emails', () => {
    expect(defangUrl('https://evil.example.test/a?b=c')).toBe('hxxps[://]evil[.]example[.]test/a?b=c')
    expect(defangUrl('http://user@203.0.113.9/x')).toBe('hxxp[://]user[@]203[.]0[.]113[.]9/x')
    expect(defangDomain('a.b.c')).toBe('a[.]b[.]c')
    expect(defangEmail('a@b.com')).toBe('a[@]b[.]com')
  })
  it('defangs inside free text but leaves prose alone', () => {
    const out = defangText('Visit https://evil.test/login or mail bad@evil.test now. See 203.0.113.9.')
    expect(out).not.toMatch(/https?:\/\//)
    expect(out).toContain('bad[@]evil[.]test')
    expect(out).toContain('203[.]0[.]113[.]9')
    expect(out).toContain('now.')
  })
})
