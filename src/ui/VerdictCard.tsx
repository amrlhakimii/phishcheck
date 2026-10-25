import type { AnalysisResult } from '../analyze'
import { Badge, Card, Eyebrow, type BadgeTone } from './primitives'
import { TONE_HEX } from './tone'

function Gauge({ score, color }: { score: number; color: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1a1424" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`} transform="rotate(-90 60 60)"
      />
      <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fill="#f0ecfa" fontSize="30" fontWeight="800" fontFamily="Syne, system-ui, sans-serif">
        {score}
      </text>
      <text x="60" y="84" textAnchor="middle" fill="#f0ecfa" fillOpacity="0.4" fontSize="9" letterSpacing="1.5">
        OF 100
      </text>
    </svg>
  )
}

export function VerdictCard({ result }: { result: AnalysisResult }) {
  const { score } = result
  const color = TONE_HEX[score.band.tone] ?? '#a78bfa'
  const goodSigns = result.findings.filter((f) => f.severity === 'good')
  return (
    <Card className="fade-up">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <Gauge score={score.score} color={color} />
        <div className="min-w-0 flex-1">
          <Eyebrow>Verdict</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1" style={{ color }}>{score.band.label}</h2>
          <p className="text-sm text-[#f0ecfa]/70 mb-3">{score.band.blurb}</p>
          {score.floorReason && (
            <p className="text-xs text-[#f0ecfa]/50 mb-3" data-testid="floor-note">Verdict floor applied: the number is {score.score}, but the verdict is raised because {score.floorReason}.</p>
          )}
          <Eyebrow className="mb-2">Top reasons</Eyebrow>
          {score.topReasons.length === 0 ? (
            <p className="text-sm text-[#f0ecfa]/50">No red flags found. This is not a guarantee: stay careful with unexpected requests.</p>
          ) : (
            <ol className="space-y-1.5">
              {score.topReasons.map((f, i) => (
                <li key={f.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#a78bfa]/20 text-xs font-bold text-[#a78bfa]">{i + 1}</span>
                  <span>{f.title}</span>
                </li>
              ))}
            </ol>
          )}
          {goodSigns.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={'success' as BadgeTone}>Good signs</Badge>
              <span className="text-xs text-[#f0ecfa]/50">{goodSigns.length} positive signal{goodSigns.length > 1 ? 's' : ''} lowered the score</span>
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs text-[#f0ecfa]/30">
        Indicators and a heuristic score, not a guarantee. Marketing email can trigger link, wording and tracking checks, so a flag is a reason to look closer, not proof.
      </p>
    </Card>
  )
}
