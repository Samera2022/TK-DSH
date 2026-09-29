import { describe, expect, it, vi } from 'vitest'
import {
  CCR_PROVIDER_ID,
  CCR_ROUTER_MANAGED_MODEL_ID,
  CcrClient,
  ContinuityHttpError,
  resolveCcrBaseUrl,
} from '../src/index.ts'

describe('CCR bridge', () => {
  it('exposes one router-managed provider slot', () => {
    expect(CCR_PROVIDER_ID).toBe('ccr')
    expect(CCR_ROUTER_MANAGED_MODEL_ID).toBe('router-managed')
  })

  it('normalizes the configured base URL', () => {
    expect(resolveCcrBaseUrl(' http://127.0.0.1:3456/// ')).toBe('http://127.0.0.1:3456')
    expect(resolveCcrBaseUrl('  ')).toBeUndefined()
  })

  it('requests the CCR integration snapshot without exposing credentials', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ skills: [{ id: 'review' }], mcpServers: [] }), { status: 200 }))
    const client = new CcrClient({ baseUrl: 'http://ccr', token: 'secret', fetch })
    await expect(client.getIntegrations()).resolves.toEqual({ skills: [{ id: 'review' }], mcpServers: [] })
    const request = fetch.mock.calls[0]?.[0]
    expect(request instanceof Request ? request.url : request).toBe('http://ccr/__ccr/integrations/v1')
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer secret')
  })

  it('creates and reads continuity checkpoints through the CCR bridge', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        checkpoint: {
          id: 'chk_1',
          projectDirectory: '/tmp/project',
          client: 'deepseek-harness',
          gitBranch: 'main',
          gitHeadSha: 'abc',
          gitDirty: false,
          objective: null,
          completed: [],
          blockers: [],
          nextSteps: [],
          modifiedFiles: [],
          verificationStatus: 'passed',
          createdAt: 1,
          updatedAt: 2,
        },
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        gitState: { branch: 'main', headSha: 'abc', dirty: false },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkpoint: null }), { status: 200 }))
    const client = new CcrClient({ baseUrl: 'http://ccr', token: 'secret', fetch })
    await expect(client.createCheckpoint({ projectDirectory: '/tmp/project' })).resolves.toMatchObject({
      id: 'chk_1',
    })
    await expect(client.getGitState('/tmp/project')).resolves.toEqual({
      branch: 'main',
      headSha: 'abc',
      dirty: false,
    })
    await expect(client.getLatestCheckpoint('/tmp/project', 'main')).resolves.toBeNull()
    expect(fetch.mock.calls[0]?.[0]).toBe('http://ccr/__ccr/continuity/v1/checkpoints')
  })

  it('reports continuity HTTP failures with response details', async () => {
    const client = new CcrClient({
      baseUrl: 'http://ccr',
      fetch: async () => new Response('offline', { status: 503 }),
    })
    await expect(client.getGitState('/tmp/project')).rejects.toEqual(
      new ContinuityHttpError(503, 'offline'),
    )
  })
})
