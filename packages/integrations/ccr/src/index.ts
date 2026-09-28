/** Optional bridge to the CCR project-history and integrations services. */
import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'

export const name = 'ccr'
export const inject = ['sessions']

export interface CcrClientOptions {
  readonly baseUrl: string
  readonly token?: string
  readonly client?: string
  readonly fetch?: typeof globalThis.fetch
}

export interface CcrIntegrationSnapshot {
  readonly skills: readonly Record<string, unknown>[]
  readonly mcpServers: readonly Record<string, unknown>[]
}

export function resolveCcrBaseUrl(value = process.env.CCR_BASE_URL): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, '')
  return trimmed === '' ? undefined : trimmed
}

export class CcrClient {
  private readonly requestFetch: typeof globalThis.fetch

  constructor(private readonly options: CcrClientOptions) {
    this.requestFetch = options.fetch ?? globalThis.fetch
  }

  async createThread(projectDirectory: string, id: string, signal?: AbortSignal): Promise<void> {
    await this.request('/__ccr/history/v1/threads', {
      method: 'POST',
      body: { id, client: this.options.client ?? 'deepseek-harness', projectDirectory },
      signal,
    })
  }

  async appendMessage(threadId: string, event: SessionEvent, signal?: AbortSignal): Promise<void> {
    if (event.type !== 'user/message' && event.type !== 'assistant/message') return
    const message = event.data.message
    await this.request(`/__ccr/history/v1/threads/${encodeURIComponent(threadId)}/messages`, {
      method: 'POST',
      body: { id: `seq_${String(event.seq)}`, role: message.role, content: message.content, source: event.type },
      signal,
    })
  }

  async getIntegrations(signal?: AbortSignal): Promise<CcrIntegrationSnapshot> {
    const result = await this.request('/__ccr/integrations/v1', { signal }) as Partial<CcrIntegrationSnapshot>
    return {
      skills: Array.isArray(result.skills) ? result.skills.filter(isRecord) : [],
      mcpServers: Array.isArray(result.mcpServers) ? result.mcpServers.filter(isRecord) : [],
    }
  }

  private async request(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<unknown> {
    const headers = new Headers({ accept: 'application/json' })
    if (init.body !== undefined) headers.set('content-type', 'application/json')
    if (this.options.token) headers.set('authorization', `Bearer ${this.options.token}`)
    const response = await this.requestFetch(`${this.options.baseUrl}${path}`, {
      method: init.method ?? 'GET', headers, signal: init.signal,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const payload: unknown = await response.json().catch(() => ({}))
    if (!response.ok && response.status !== 409) throw new Error(`CCR request failed (${response.status}): ${JSON.stringify(payload)}`)
    return payload
  }
}

export function apply(ctx: Context): void {
  const baseUrl = resolveCcrBaseUrl()
  if (baseUrl === undefined) return
  const client = new CcrClient({ baseUrl, token: process.env.CCR_TOKEN })
  const threads = new WeakMap<Session, Promise<void>>()
  const queued = new WeakMap<Session, Promise<void>>()

  const threadFor = (session: Session): Promise<void> => {
    let thread = threads.get(session)
    if (thread === undefined) {
      thread = client.createThread(session.header.cwd ?? process.cwd(), session.header.id)
      threads.set(session, thread)
    }
    return thread
  }

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'user/message' && event.type !== 'assistant/message') return
    const previous = queued.get(session) ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(() => threadFor(session))
      .then(() => client.appendMessage(session.header.id, event))
    queued.set(session, next)
    void next.catch(error => ctx.logger.warn(`CCR history sync failed: ${String(error)}`))
  })
  ctx.on('session/disposed', session => {
    threads.delete(session)
    queued.delete(session)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
