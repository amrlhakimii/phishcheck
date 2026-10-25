import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyze, withExtraFindings, type AnalysisResult } from './analyze'
import { LIMITS } from './parse/limits'
import { dnsFindings, lookupSenderDomain, type DnsSummary } from './doh'
import { buildReport } from './report'
import { InputPanel } from './ui/InputPanel'
import { VerdictCard } from './ui/VerdictCard'
import { FindingsTab } from './ui/FindingsTab'
import { HeadersTab } from './ui/HeadersTab'
import { LinksTab } from './ui/LinksTab'
import { ChecklistTab } from './ui/ChecklistTab'
import { ScorePanel } from './ui/ScorePanel'
import { EnrichmentToggle } from './ui/EnrichmentToggle'
import { Button, Card, EmptyState, Eyebrow, Skeleton, Tabs } from './ui/primitives'

type View = { kind: 'empty' } | { kind: 'analysing' } | { kind: 'error'; message: string } | { kind: 'result'; result: AnalysisResult }

const TABS = [
  { id: 'findings', label: 'Findings' },
  { id: 'headers', label: 'Headers' },
  { id: 'links', label: 'Links' },
  { id: 'checklist', label: 'Checklist' },
]

export default function App() {
  const [raw, setRaw] = useState('')
  const [view, setView] = useState<View>({ kind: 'empty' })
  const [tab, setTab] = useState('findings')
  const [enrich, setEnrich] = useState(false)
  const [dns, setDns] = useState<DnsSummary | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((m: string) => {
    setToast(m)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1800)
  }, [])

  const run = useCallback((text: string) => {
    setView({ kind: 'analysing' })
    setTab('findings')
    // Yield once so the skeleton can paint before the (synchronous) analysis runs.
    window.setTimeout(() => {
      const out = analyze(text)
      setView(out.ok ? { kind: 'result', result: out } : { kind: 'error', message: out.message })
    }, 60)
  }, [])

  const onFile = useCallback(
    async (f: File) => {
      if (f.size > LIMITS.maxInput) {
        setView({ kind: 'error', message: `That file is larger than the ${LIMITS.maxInput / 1024 / 1024} MB limit.` })
        return
      }
      const text = await f.text()
      setRaw(text)
      run(text)
    },
    [run],
  )

  const base = view.kind === 'result' ? view.result : null
  const senderDomain = base?.ctx.from?.domain ?? ''

  useEffect(() => {
    if (!enrich || !senderDomain) return
    let cancelled = false
    lookupSenderDomain(senderDomain)
      .catch((): DnsSummary => ({ domain: senderDomain, exists: null, spf: null, dmarc: null, errors: ['Lookup failed'] }))
      .then((s) => { if (!cancelled) setDns(s) })
    return () => { cancelled = true }
  }, [enrich, senderDomain])

  const dnsActive = enrich && dns && dns.domain === senderDomain.toLowerCase() ? dns : null
  const dnsLoading = enrich && !!senderDomain && !dnsActive
  const result = useMemo(() => (base ? (dnsActive ? withExtraFindings(base, dnsFindings(dnsActive)) : base) : null), [base, dnsActive])

  const exportReport = () => {
    if (!result) return
    const md = buildReport(result)
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'phishcheck-report.md'
    a.click()
    URL.revokeObjectURL(url)
    showToast('Report downloaded')
  }
  const copyReport = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(buildReport(result))
      showToast('Report copied')
    } catch {
      showToast('Copy failed: use Download instead')
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/5" style={{ background: 'rgba(26,20,36,0.8)', backdropFilter: 'blur(16px)' }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <a href="/" className="font-display text-lg font-extrabold tracking-tight" aria-label="PhishCheck home">
            <span className="text-[#a78bfa]">Phish</span>Check
          </a>
          <span className="rounded-full bg-[#a78bfa]/20 px-3 py-1 text-xs font-medium text-[#a78bfa]">Runs in your browser</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 pb-16">
        <section>
          <Eyebrow className="mb-1">Phishing email checker</Eyebrow>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Paste an email. See why it looks suspicious.</h1>
          <p className="mt-2 text-sm text-[#f0ecfa]/60">
            <strong className="text-[#f0ecfa]/80">Your email never leaves your browser.</strong> Nothing is uploaded or stored, no link is opened, no image is loaded and no HTML is rendered.
            PhishCheck reports indicators and a heuristic score. It is not a guarantee of safety.
          </p>
        </section>

        <InputPanel value={raw} onChange={setRaw} onAnalyse={() => run(raw)} onSample={(s) => { setRaw(s); run(s) }} onFile={onFile} busy={view.kind === 'analysing'} />

        <EnrichmentToggle enabled={enrich} onChange={setEnrich} loading={dnsLoading} summary={dnsActive} />

        <div aria-live="polite">
          {view.kind === 'empty' && (
            <Card>
              <EmptyState icon="📬" title="Nothing to check yet">Paste raw email source above or load one of the invented samples to see how it works.</EmptyState>
            </Card>
          )}
          {view.kind === 'analysing' && (
            <div className="space-y-3" role="status" aria-label="Analysing">
              <Skeleton className="h-40" />
              <Skeleton className="h-12" />
              <Skeleton className="h-32" />
            </div>
          )}
          {view.kind === 'error' && (
            <Card>
              <div role="alert">
                <Eyebrow className="mb-1">Could not read this</Eyebrow>
                <h2 className="text-lg font-bold mb-1">{view.message.startsWith('This') ? "This doesn't look like raw email source." : 'Cannot analyse this input.'}</h2>
                <p className="text-sm text-[#f0ecfa]/70 mb-3">{view.message}</p>
                <p className="text-sm text-[#f0ecfa]/70">Open "How to get the raw source" above: in Gmail use <em>Show original</em>, in Outlook <em>View message source</em>, in Apple Mail <em>View, Message, Raw Source</em>. Pasting only the body text or a forwarded copy will not work.</p>
              </div>
            </Card>
          )}
        </div>

        {result && (
          <div className="space-y-4">
            {result.warnings.length > 0 && (
              <Card>
                <Eyebrow className="mb-1">Parser notes</Eyebrow>
                <ul className="list-disc pl-5 text-sm text-[#f0ecfa]/70">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </Card>
            )}
            <VerdictCard result={result} />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={exportReport}>Download Markdown report</Button>
              <Button onClick={copyReport}>Copy report</Button>
            </div>
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
              {tab === 'findings' && <FindingsTab result={result} />}
              {tab === 'headers' && <HeadersTab result={result} />}
              {tab === 'links' && <LinksTab result={result} onToast={showToast} />}
              {tab === 'checklist' && <ChecklistTab band={result.score.band.id} />}
            </div>
          </div>
        )}

        <ScorePanel />

        <footer className="pt-4 text-xs text-[#f0ecfa]/30">
          <p>PhishCheck is an educational tool. It reports indicators and a heuristic score, not a verdict you can rely on. For a real incident, report it through your organisation's process.</p>
          <p className="mt-1">Samples are invented and use reserved domains (example.com, .test) and documentation IP ranges.</p>
        </footer>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2" role="status">
          <div className="toast-in rounded-full px-5 py-3 text-sm text-[#f0ecfa] backdrop-blur-md" style={{ background: 'rgba(20,20,24,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>{toast}</div>
        </div>
      )}
    </div>
  )
}
