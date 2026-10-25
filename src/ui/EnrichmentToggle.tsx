import { DOH_HOST } from '../doh'
import type { DnsSummary } from '../doh'
import { Badge, Card, Eyebrow } from './primitives'

interface Props {
  enabled: boolean
  onChange: (v: boolean) => void
  loading: boolean
  summary: DnsSummary | null
}

export function EnrichmentToggle({ enabled, onChange, loading, summary }: Props) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Optional: check DNS records</Eyebrow>
          <p className="mt-1 text-sm text-[#f0ecfa]/70">Look up the sender domain's SPF and DMARC records and whether the domain exists. Off by default.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Check DNS records"
          onClick={() => onChange(!enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors cursor-pointer ${enabled ? 'border-[#a78bfa] bg-[#a78bfa]/30' : 'border-[#2b2140] bg-[#1a1424]'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${enabled ? 'left-6 bg-[#a78bfa]' : 'left-0.5 bg-[#f0ecfa]/50'}`} />
        </button>
      </div>
      <p className="mt-3 rounded-xl bg-[#1a1424] px-3 py-2 text-xs text-[#f0ecfa]/60">
        <strong className="text-[#f0ecfa]/80">Disclosure:</strong> when switched on, only the sender's domain name (and the same name prefixed with _dmarc.) is sent over HTTPS to {DOH_HOST}, a public DNS-over-HTTPS resolver.
        It sees your IP address and that domain. Message content, subject, addresses, links and attachments are never sent.
      </p>
      {enabled && loading && <p className="mt-3 text-xs text-[#f0ecfa]/50">Looking up DNS records...</p>}
      {enabled && summary && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs" data-testid="dns-summary">
          <Badge tone={summary.exists === false ? 'danger' : summary.exists ? 'success' : 'muted'}>Domain {summary.exists === null ? 'unknown' : summary.exists ? 'exists' : 'not found'}</Badge>
          <Badge tone={summary.spf ? 'success' : 'warning'}>SPF {summary.spf ? 'published' : 'not found'}</Badge>
          <Badge tone={summary.dmarc ? 'success' : 'warning'}>DMARC {summary.dmarc ? 'published' : 'not found'}</Badge>
          {summary.errors.length > 0 && <Badge tone="muted">{summary.errors.join('; ')}</Badge>}
        </div>
      )}
    </Card>
  )
}
