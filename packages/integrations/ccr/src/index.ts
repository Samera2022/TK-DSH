/** Optional bridge to the CCR project-history and integrations services. */
import type { Context } from '@deepseek-ai/cordis'
import { resolveAdapterOptions, registerDeepSeekProvider } from '@deepseek-ai/dsh-llm-deepseek'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'project-continuity': {
      kind: 'project-continuity'
      form: 'snapshot'
      sections: readonly [{ name: 'project-continuity'; text: string }]
    }
  }
}

export const name = 'ccr'
export const inject = ['sessions', 'llm']
export const CCR_PROVIDER_ID = 'ccr'
export const CCR_ROUTER_MANAGED_MODEL_ID = 'router-managed'

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

export interface ProjectCheckpoint {
  readonly id: string
  readonly projectDirectory: string
  readonly client: string
  readonly gitBranch: string | null
  readonly gitHeadSha: string | null
  readonly gitDirty: boolean
  readonly objective: string | null
  readonly completed: readonly string[]
  readonly blockers: readonly string[]
  readonly nextSteps: readonly string[]
  readonly modifiedFiles: readonly string[]
  readonly verificationStatus: 'passed' | 'pending' | 'failed' | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface GitState {
  readonly branch: string | null
  readonly headSha: string | null
  readonly dirty: boolean
}

export interface CreateCheckpointInput {
  readonly id?: string
  readonly projectDirectory: string
  readonly client?: string
  readonly gitBranch?: string | null
  readonly gitHeadSha?: string | null
  readonly gitDirty?: boolean
  readonly objective?: string | null
  readonly completed?: readonly string[]
  readonly blockers?: readonly string[]
  readonly nextSteps?: readonly string[]
  readonly modifiedFiles?: readonly string[]
  readonly verificationStatus?: 'passed' | 'pending' | 'failed' | null
}

export class ContinuityHttpError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`CCR continuity request failed with status ${String(status)}`)
    this.name = 'ContinuityHttpError'
    this.status = status
    this.body = body
  }
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
      ...(signal === undefined ? {} : { signal }),
    })
  }

  async appendMessage(threadId: string, event: SessionEvent, signal?: AbortSignal): Promise<void> {
    if (event.type !== 'user/message' && event.type !== 'assistant/message') return
    const message = event.type === 'user/message' ? event.data : event.data.message
    await this.request(`/__ccr/history/v1/threads/${encodeURIComponent(threadId)}/messages`, {
      method: 'POST',
      body: { id: `seq_${String(event.seq)}`, role: message.role, content: message.content, source: event.type },
      ...(signal === undefined ? {} : { signal }),
    })
  }

  async getIntegrations(signal?: AbortSignal): Promise<CcrIntegrationSnapshot> {
    const result = await this.request('/__ccr/integrations/v1', signal === undefined ? {} : { signal }) as Partial<CcrIntegrationSnapshot>
    return {
      skills: Array.isArray(result.skills) ? result.skills.filter(isRecord) : [],
      mcpServers: Array.isArray(result.mcpServers) ? result.mcpServers.filter(isRecord) : [],
    }
  }

  async createCheckpoint(input: CreateCheckpointInput, signal?: AbortSignal): Promise<ProjectCheckpoint> {
    const result = await this.request('/__ccr/continuity/v1/checkpoints', {
      method: 'POST',
      body: {
        ...input,
        client: input.client ?? this.options.client ?? 'deepseek-harness',
        gitBranch: input.gitBranch ?? null,
        gitHeadSha: input.gitHeadSha ?? null,
        gitDirty: input.gitDirty ?? false,
        objective: input.objective ?? null,
        completed: input.completed ?? [],
        blockers: input.blockers ?? [],
        nextSteps: input.nextSteps ?? [],
        modifiedFiles: input.modifiedFiles ?? [],
        verificationStatus: input.verificationStatus ?? null,
      },
      ...(signal === undefined ? {} : { signal }),
    }) as { checkpoint: ProjectCheckpoint }
    return result.checkpoint
  }

  async getLatestCheckpoint(projectDirectory: string, gitBranch?: string, signal?: AbortSignal): Promise<ProjectCheckpoint | null> {
    const params = new URLSearchParams({ projectDirectory })
    if (gitBranch) params.set('gitBranch', gitBranch)
    const result = await this.request(
      `/__ccr/continuity/v1/checkpoints/latest?${params.toString()}`,
      signal === undefined ? {} : { signal },
    ) as { checkpoint: ProjectCheckpoint | null }
    return result.checkpoint
  }

  async getGitState(projectDirectory: string, signal?: AbortSignal): Promise<GitState> {
    const params = new URLSearchParams({ projectDirectory })
    const result = await this.request(
      `/__ccr/continuity/v1/git-state?${params.toString()}`,
      signal === undefined ? {} : { signal },
    ) as { gitState: GitState }
    return result.gitState
  }

  private async request(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<unknown> {
    const headers = new Headers({ accept: 'application/json' })
    if (init.body !== undefined) headers.set('content-type', 'application/json')
    if (this.options.token) headers.set('authorization', `Bearer ${this.options.token}`)
    const response = await this.requestFetch(`${this.options.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.signal === undefined ? {} : { signal: init.signal }),
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
    const text = await response.text()
    let payload: unknown = {}
    if (text !== '') {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = text
      }
    }
    if (!response.ok && response.status !== 409) {
      if (path.startsWith('/__ccr/continuity/')) {
        throw new ContinuityHttpError(response.status, typeof payload === 'string' ? payload : JSON.stringify(payload))
      }
      throw new Error(`CCR request failed (${response.status}): ${JSON.stringify(payload)}`)
    }
    return payload
  }
}

export function apply(ctx: Context): void {
  const baseUrl = resolveCcrBaseUrl()
  if (baseUrl === undefined) return
  const token = process.env.CCR_TOKEN
  const client = new CcrClient({ baseUrl, ...(token === undefined ? {} : { token }) })

  registerDeepSeekProvider(ctx, CCR_PROVIDER_ID, {
    providerName: 'CCR Provider',
    discoverModels: provider => Promise.resolve([{
      provider,
      id: CCR_ROUTER_MANAGED_MODEL_ID,
      name: 'Router managed',
      description: 'CCR selects the target provider and model for every request.',
      inputModalities: ['text', 'image'],
    }]),
    options: () => resolveAdapterOptions({
      baseURL: baseUrl,
      models: [{
        id: CCR_ROUTER_MANAGED_MODEL_ID,
        name: 'Router managed',
        description: 'CCR selects the target provider and model for every request.',
        inputModalities: ['text', 'image'],
        systemPromptUpdate: 'in-history',
        toolUpdate: 'in-history',
      }],
    }),
    resolveAuth: () => Promise.resolve({
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    }),
  })

  const threads = new WeakMap<Session, Promise<void>>()
  const queued = new WeakMap<Session, Promise<void>>()
  const continuityBootstrap = new WeakMap<Session, Promise<ProjectCheckpoint | null>>()
  const continuityInjected = new WeakSet<Session>()

  const threadFor = (session: Session): Promise<void> => {
    let thread = threads.get(session)
    if (thread === undefined) {
      thread = client.createThread(session.header.cwd ?? process.cwd(), session.header.id)
      threads.set(session, thread)
    }
    return thread
  }

  ctx.on('session/created', (session) => {
    const projectDirectory = session.header.cwd ?? process.cwd()
    const bootstrap = client.getGitState(projectDirectory)
      .then(gitState => client.getLatestCheckpoint(projectDirectory, gitState.branch ?? undefined))
    continuityBootstrap.set(session, bootstrap)
    void bootstrap.catch((error: unknown) => {
      ctx.logger.warn(`CCR continuity bootstrap failed: ${String(error)}`)
    })
  })

  ctx.on('session/event', (session, event) => {
    if (event.type === 'turn/start' && !continuityInjected.has(session)) {
      continuityInjected.add(session)
      const bootstrap = continuityBootstrap.get(session)
      if (bootstrap !== undefined) {
        queueMicrotask(() => {
          void bootstrap
            .then((checkpoint) => {
              if (checkpoint === null) return
              const text = renderCheckpoint(checkpoint)
              session.append('user/message', createUserMessage({
                content: [{ type: 'text', text }],
                source: {
                  kind: 'project-continuity',
                  form: 'snapshot',
                  sections: [{ name: 'project-continuity', text }],
                },
              }), { surfaceOp: 'append' })
            })
            .catch((error: unknown) => {
              ctx.logger.warn(`CCR continuity injection failed: ${String(error)}`)
            })
        })
      }
    }
    if (event.type !== 'user/message' && event.type !== 'assistant/message') return
    const previous = queued.get(session) ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(() => threadFor(session))
      .then(() => client.appendMessage(session.header.id, event))
    queued.set(session, next)
    void next.catch((error: unknown) => {
      ctx.logger.warn(`CCR history sync failed: ${String(error)}`)
    })
  })
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return
    const projectDirectory = session.header.cwd ?? process.cwd()
    const failed = event.data.reason.kind !== 'completed'
    const assistantMessage = [...session.snapshotEvents()]
      .reverse()
      .find(candidate => candidate.type === 'assistant/message')
    const completed = assistantMessage?.type === 'assistant/message'
      ? assistantMessage.data.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
      : undefined
    void client.getGitState(projectDirectory)
      .then(gitState => client.createCheckpoint({
        projectDirectory,
        client: 'deepseek-harness',
        gitBranch: gitState.branch,
        gitHeadSha: gitState.headSha,
        gitDirty: gitState.dirty,
        completed: failed || completed === undefined ? [] : [completed.slice(0, 8_000)],
        blockers: failed ? ['The turn failed or was interrupted.'] : [],
        verificationStatus: failed ? 'failed' : 'passed',
      }))
      .catch((error: unknown) => {
        ctx.logger.warn(`CCR continuity checkpoint save failed: ${String(error)}`)
      })
  })
  ctx.on('session/disposed', (session) => {
    threads.delete(session)
    queued.delete(session)
    continuityBootstrap.delete(session)
  })
}

function renderCheckpoint(checkpoint: ProjectCheckpoint): string {
  const sections = [
    '# Project Continuity Checkpoint',
    `Project: ${checkpoint.projectDirectory}`,
    checkpoint.gitBranch === null ? undefined : `Branch: ${checkpoint.gitBranch}`,
    checkpoint.objective === null ? undefined : `Objective: ${checkpoint.objective}`,
    checkpoint.completed.length === 0 ? undefined : `Completed:\n${checkpoint.completed.map(item => `- ${item}`).join('\n')}`,
    checkpoint.blockers.length === 0 ? undefined : `Blockers:\n${checkpoint.blockers.map(item => `- ${item}`).join('\n')}`,
    checkpoint.nextSteps.length === 0 ? undefined : `Next steps:\n${checkpoint.nextSteps.map(item => `- ${item}`).join('\n')}`,
  ].filter((value): value is string => value !== undefined)
  return sections.join('\n\n').slice(0, 8_000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
