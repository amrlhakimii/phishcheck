import type { AnalysisResult } from '../analyze'
import type { Severity } from '../types'
import { Badge, Card, Disclosure, EmptyState, Eyebrow } from './primitives'
import { SEVERITY_LABEL, SEVERITY_TONE } from './tone'

const ORDER: Severity[] = ['high', 'medium', 'low', 'info', 'good']
const GROUP_TITLE: Record<Severity, string> = { high: 'High severity', medium: 'Medium severity', low: 'Low severity', info: 'Information', good: 'Good signs' }
const MAX_BODY = 20_000

export function FindingsTab({ result }: { result: AnalysisResult }) {
  const { findings } = result
  const body = result.ctx.bodyText
  const shown = body.length > MAX_BODY ? body.slice(0, MAX_BODY) : body
  return (
    <div className="space-y-4">
      {findings.length === 0 && (
        <Card>
          <EmptyState icon="🔍" title="No indicators found">
            None of the 12 checks fired. That is not proof the message is safe: stay careful with unexpected requests.
          </EmptyState>
        </Card>
      )}
      {ORDER.map((sev) => {
        const group = findings.filter((f) => f.severity === sev)
        if (!group.length) return null
        return (
          <section key={sev} aria-label={GROUP_TITLE[sev]} className="space-y-3">
            <Eyebrow>{GROUP_TITLE[sev]} ({group.length})</Eyebrow>
            {group.map((f) => (
              <Card key={f.id}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge tone={SEVERITY_TONE[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
                  <Badge tone="muted">{f.check}</Badge>
                  <span className={`text-xs font-mono ${f.points < 0 ? 'text-green-400' : 'text-[#f0ecfa]/50'}`}>{f.points > 0 ? `+${f.points}` : f.points} pts</span>
                </div>
                <h3 className="text-base font-bold tracking-tight mb-2">{f.title}</h3>
                <p className="text-xs text-[#f0ecfa]/50 uppercase tracking-wider mb-1">What we saw</p>
                <p className="mb-3 break-words rounded-xl bg-[#1a1424] px-3 py-2 font-mono text-xs text-[#f0ecfa]/80">{f.evidence}</p>
                <p className="text-xs text-[#f0ecfa]/50 uppercase tracking-wider mb-1">Why it matters</p>
                <p className="mb-3 text-sm text-[#f0ecfa]/80">{f.why}</p>
                <p className="text-xs text-[#f0ecfa]/50 uppercase tracking-wider mb-1">What to do</p>
                <p className="text-sm text-[#f0ecfa]/80">{f.action}</p>
              </Card>
            ))}
          </section>
        )
      })}
      {result.email.attachments.length > 0 && (
        <Card>
          <Eyebrow className="mb-2">Attachments (names and types only, never opened)</Eyebrow>
          <ul className="space-y-1 text-sm font-mono break-all">
            {result.email.attachments.map((a, i) => (
              <li key={i}>{a.filename || '(unnamed)'} <span className="text-[#f0ecfa]/40">{a.contentType}</span></li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <Disclosure title="Message body (plain text, never rendered)" id="body-view">
          <p className="text-xs text-[#f0ecfa]/40 mb-2">
            Shown as escaped text. HTML, scripts, styles and images from the email are never run or loaded.
            {body.length > MAX_BODY && ' Showing the first 20,000 characters.'}
          </p>
          <pre data-testid="body-text" className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#1a1424] p-3 font-mono text-xs text-[#f0ecfa]/80">
            {shown || '(empty body)'}
          </pre>
        </Disclosure>
      </Card>
    </div>
  )
}
