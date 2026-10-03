/**
 * CCR HTTP Client for model switching and orchestra management
 */

import type { CcrConfig, SwitchModelResponse, BudgetState, OrchestraConfig, Role } from './types.ts'

export class CcrClient {
  private baseUrl: string
  private apiKey: string | undefined
  private clientId: string
  private sessionId: string | undefined

  constructor(config: CcrConfig, clientId: string = 'dsh', sessionId?: string) {
    this.baseUrl = config.baseUrl || process.env.CCR_BASE_URL || 'http://localhost:8788'
    this.apiKey = config.apiKey || process.env.CCR_API_KEY
    this.clientId = clientId
    this.sessionId = sessionId
  }

  /**
   * Get list of available models from CCR
   */
  async getModels(): Promise<{ id: string; displayName: string; provider: string }[]> {
    const response = await this.request('/__ccr/model-control/v1/models', { method: 'GET' })
    const data = await response.json()
    return data.models || []
  }

  /**
   * Switch to a different model
   */
  async switchModel(model: string, reason: string): Promise<SwitchModelResponse> {
    const response = await this.request('/__ccr/model-control/v1/switch', {
      method: 'POST',
      body: JSON.stringify({ sessionKey: this.getSessionKey(), targetModel: model, reason }),
    })

    return await response.json()
  }

  /**
   * Get budget state for a model
   */
  async getBudgetState(_model: string): Promise<BudgetState> {
    const response = await this.request(`/__ccr/model-control/v1/budget/${this.getSessionKey()}`, {
      method: 'GET',
    })

    return await response.json()
  }

  /**
   * Respond to budget confirmation request
   */
  async respondToBudgetConfirmation(
    action: 'continue' | 'switch' | 'stop',
    model?: string,
    targetModel?: string,
  ): Promise<{ success: boolean; message: string }> {
    const body: any = { action, sessionKey: this.getSessionKey() }
    if (model) body.model = model
    if (targetModel) body.targetModel = targetModel

    const response = await this.request('/__ccr/model-control/v1/budget-confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return await response.json()
  }

  /**
   * Reset budget tracking
   */
  async resetBudget(model?: string): Promise<{ success: boolean; message: string }> {
    const response = await this.request('/v2/ccr/budget/reset', {
      method: 'POST',
      body: JSON.stringify({ model }),
    })

    return await response.json()
  }

  /**
   * Get orchestra configuration
   */
  async getOrchestraConfig(): Promise<OrchestraConfig> {
    const response = await this.request('/__ccr/orchestra/v1/config', { method: 'GET' })
    return await response.json()
  }

  /**
   * Update orchestra configuration
   */
  async updateOrchestraConfig(config: OrchestraConfig): Promise<{ success: boolean; message: string }> {
    const response = await this.request('/__ccr/orchestra/v1/config', {
      method: 'POST',
      body: JSON.stringify(config),
    })

    return await response.json()
  }

  /**
   * Get all roles
   */
  async getRoles(): Promise<Role[]> {
    const response = await this.request('/v2/ccr/orchestra/roles', { method: 'GET' })
    const data = await response.json()
    return data.roles || []
  }

  /**
   * Add or update a role
   */
  async upsertRole(role: Role): Promise<{ success: boolean; message: string }> {
    const response = await this.request('/v2/ccr/orchestra/roles', {
      method: 'POST',
      body: JSON.stringify(role),
    })

    return await response.json()
  }

  /**
   * Delete a role
   */
  async deleteRole(roleName: string): Promise<{ success: boolean; message: string }> {
    const response = await this.request(`/v2/ccr/orchestra/roles/${encodeURIComponent(roleName)}`, {
      method: 'DELETE',
    })

    return await response.json()
  }

  /**
   * Get session key for API calls
   */
  private getSessionKey(): string {
    return `${this.clientId}:${this.sessionId || 'default'}`
  }


  /**
   * Internal request helper
   */
  private async request(path: string, options: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-cc-switch-client': this.clientId,
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    if (this.sessionId) {
      headers['x-ccr-session-id'] = this.sessionId
    }

    const url = `${this.baseUrl}${path}`

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    })

    if (!response.ok && response.status >= 500) {
      throw new Error(`CCR request failed: ${response.status} ${response.statusText}`)
    }

    return response
  }
}
