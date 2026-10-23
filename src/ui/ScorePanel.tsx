import { BANDS, CHECK_CAPS, GOOD_CAP, WEIGHTS } from '../weights'
import { CHECKS } from '../checks'
import { Card, Disclosure } from './primitives'

const NAMES: Record<string, string> = { ...Object.fromEntries(CHECKS.map((c) => [c.id, c.name])), C12: 'Positive signals', DNS: 'Optional DNS check' }

export function ScorePanel() {
  const groups = [...new Set(WEIGHTS.map((w) => w.check))]
  return (
    <Card>
      <Disclosure title="How the score works" id="how-score-works">
        <div className="space-y-4 text-sm text-[#EEEEEE]/70">
          <p>
            Every finding adds fixed points (or subtracts, for good signs). The total is clamped to 0-100. There is no hidden logic and no machine learning:
            these are the exact weights used by the code. Each check can add at most its cap, so one noisy check cannot decide the verdict alone.
          </p>
          <div className="overflow-x-auto rounded-xl" style={{ background: '#222831' }}>
            <table className="w-full text-left text-xs min-w-[28rem]">
              <caption className="sr-only">Score weights per finding</caption>
              <thead>
                <tr className="text-[#EEEEEE]/50 uppercase tracking-wider">
                  <th scope="col" className="px-3 py-2 font-semibold">Check</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Finding</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g} check={g} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[#EEEEEE]/60">
            <li>Per-check caps: {Object.entries(CHECK_CAPS).map(([k, v]) => `${k} max +${v}`).join(', ')}. Good signs together can lower the score by at most {Math.abs(GOOD_CAP)}.</li>
            <li>Good signs (C12) are ignored when any high-severity finding exists, because attackers can pass authentication on a domain they own.</li>
            <li>The optional DNS check only adds findings when you switch it on.</li>
          </ul>
          <div>
            <p className="text-xs text-[#EEEEEE]/50 uppercase tracking-wider mb-2">Verdict bands</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BANDS.map((b) => (
                <li key={b.id} className="rounded-xl bg-[#222831] px-3 py-2">
                  <span className="block font-semibold text-[#EEEEEE]">{b.label}</span>
                  <span className="text-xs text-[#EEEEEE]/50">{b.min}-{b.max}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-[#EEEEEE]/40">
            A low score means no obvious red flags, never that the message is safe. A high score means many indicators, never that it is certainly malicious.
          </p>
        </div>
      </Disclosure>
    </Card>
  )
}

function GroupRows({ check }: { check: string }) {
  const rows = WEIGHTS.filter((w) => w.check === check)
  return (
    <>
      {rows.map((w, i) => (
        <tr key={w.code} className="border-t border-white/5">
          <td className="px-3 py-2 align-top text-[#EEEEEE]/60 whitespace-nowrap">{i === 0 ? `${check} ${NAMES[check] ?? ''}` : ''}</td>
          <td className="px-3 py-2 align-top">{w.label}</td>
          <td className={`px-3 py-2 align-top text-right font-mono ${w.points < 0 ? 'text-green-400' : ''}`}>{w.points > 0 ? `+${w.points}` : w.points}</td>
        </tr>
      ))}
    </>
  )
}
