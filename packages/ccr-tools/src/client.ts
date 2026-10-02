/**
 * CCR HTTP client for model switching
 */

import type {
  AvailableModel,
  ModelsResponse,
  SwitchModelRequest,
  SwitchModelResponse,
  CcrConfig,
} from './types.ts'

export class CcrClient {
  constructor(
    private readonly config: CcrConfig,
    private readonly clientId: string = 'dsh',
    private readonly sessionId?: string,
  ) {}

  async getModels(): Promise<AvailableModel[]> {
    const url = `${this.config.baseUrl}/v1/ccr/models`

    const headers: Record<string, string> = {}
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw new Error(`Failed to get models: ${response.statusText}`)
    }

    const data = (await response.json()) as ModelsResponse
    return data.models
  }

  async switchModel(model: string, reason: string): Promise<SwitchModelResponse> {
    const url = `${this.config.baseUrl}/v1/ccr/switch-model`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-cc-switch-client': this.clientId,
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    if (this.sessionId) {
      headers['x-ccr-session-id'] = this.sessionId
    }

    const body: SwitchModelRequest = { model, reason }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = (await response.json()) as SwitchModelResponse
    return data
  }
}
