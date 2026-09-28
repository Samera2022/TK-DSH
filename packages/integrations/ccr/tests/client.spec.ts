import { describe, expect, it, vi } from 'vitest'
import { CcrClient, resolveCcrBaseUrl } from '../src/index.ts'

describe('CCR bridge', () => {
  it('normalizes the configured base URL', () => {
    expect(resolveCcrBaseUrl(' http://127.0.0.1:3456/// ')).toBe('http://127.0.0.1:3456')
    expect(resolveCcrBaseUrl('  ')).toBeUndefined()
  })

  it('requests the CCR integration snapshot without exposing credentials', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ skills: [{ id: 'review' }], mcpServers: [] }), { status: 200 }))
    const client = new CcrClient({ baseUrl: 'http://ccr', token: 'secret', fetch })
    await expect(client.getIntegrations()).resolves.toEqual({ skills: [{ id: 'review' }], mcpServers: [] })
    const request = fetch.mock.calls[0]?.[0]
    expect(String(request)).toBe('http://ccr/__ccr/integrations/v1')
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual(expect.objectContaining({ authorization: 'Bearer secret' }))
  })
})
