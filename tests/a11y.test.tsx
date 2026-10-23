import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import App from '../src/App'

afterEach(cleanup)

async function violations(node: HTMLElement) {
  // jsdom has no layout engine, so colour-contrast and region checks are not meaningful here.
  const r = await axe.run(node, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

describe('accessibility (axe, structural rules)', () => {
  it('home screen has no violations', async () => {
    const { container } = render(<App />)
    expect(await violations(container)).toEqual([])
  })
  it.each(['Findings', 'Headers', 'Links', 'Checklist'])('result view, %s tab, has no violations', async (tab) => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: /obvious phish/i }))
    await screen.findByRole('heading', { level: 2, name: 'Likely phishing' })
    await user.click(screen.getByRole('tab', { name: tab }))
    expect(await violations(container)).toEqual([])
  })
})
