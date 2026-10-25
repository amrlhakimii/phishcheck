import { useState } from 'react'
import type { AnalysisResult } from '../analyze'
import { FLAG_LABELS, type LinkFlag } from '../links'
import { Badge, Button, Card, EmptyState, Eyebrow, type BadgeTone } from './primitives'

const DANGEROUS: LinkFlag[] = ['text-mismatch', 'userinfo', 'ip-obfuscated', 'data-url', 'javascript-url', 'lookalike', 'punycode']

export function LinksTab({ result, onToast }: { result: AnalysisResult; onToast: (m: string) => void }) {
  const links = result.ctx.links
  const [showRaw, setShowRaw] = useState(false)
  const copyAll = async () => {
    const text = links.map((l) => l.defanged).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      onToast('Defanged links copied')
    } catch {
      onToast('Copy failed: select and copy manually')
    }
  }
  if (links.length === 0) {
    return (
      <Card>
        <EmptyState icon="🔗" title="No links found">There were no URLs in the text or HTML parts of this message.</EmptyState>
      </Card>
    )
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <Eyebrow>Links ({links.length})</Eyebrow>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowRaw((v) => !v)} aria-pressed={showRaw}>{showRaw ? 'Hide' : 'Show'} raw destinations</Button>
          <Button onClick={copyAll}>Copy all defanged</Button>
        </div>
      </div>
      <p className="text-xs text-[#f0ecfa]/40 mb-3">
        Links are shown as plain text and are never clickable or fetched. Defanged form (hxxp, [.]) is safe to paste into tickets and chats.
        Raw destinations are hidden by default{showRaw ? ' (now shown as inert text)' : ''}.
      </p>
      <div className="overflow-x-auto rounded-xl" style={{ background: '#1a1424' }}>
        <table className="w-full text-left text-xs min-w-[44rem]">
          <caption className="sr-only">Links found in the message</caption>
          <thead>
            <tr className="text-[#f0ecfa]/50 uppercase tracking-wider">
              <th scope="col" className="px-3 py-2 font-semibold">Shown text</th>
              <th scope="col" className="px-3 py-2 font-semibold">Real destination</th>
              <th scope="col" className="px-3 py-2 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l, i) => (
              <tr key={i} data-testid="link-row" className="border-t border-white/5">
                <td className="px-3 py-2 align-top break-words max-w-[14rem]">
                  {l.text ? <span data-testid="link-text">{l.text}</span> : <span className="text-[#f0ecfa]/30">(bare URL in text)</span>}
                </td>
                <td className="px-3 py-2 align-top break-all font-mono">
                  <span data-testid="link-defanged">{l.defanged}</span>
                  {l.ipNormalized && l.hostKind !== 'ip' && <span className="block text-[#f0ecfa]/40">resolves as IP {l.ipNormalized.replace(/\./g, '[.]')}</span>}
                  {showRaw && <span data-testid="link-raw" className="mt-1 block text-[#f0ecfa]/40">raw: {l.href.slice(0, 300)}</span>}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-wrap gap-1">
                    {l.flags.length === 0 && <Badge tone="success">No flags</Badge>}
                    {l.flags.map((f) => {
                      const tone: BadgeTone = DANGEROUS.includes(f) ? 'danger' : 'warning'
                      return <Badge key={f} tone={tone}>{FLAG_LABELS[f]}</Badge>
                    })}
                  </div>
                  {l.claimedHost && l.flags.includes('text-mismatch') && (
                    <p className="mt-1 text-[#f0ecfa]/50">Text claims <span className="font-mono">{l.claimedHost.replace(/\./g, '[.]')}</span></p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
