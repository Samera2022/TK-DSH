/**
 * Types for CCR integration
 */

export interface AvailableModel {
  id: string
  displayName: string
  provider: string
  contextTokens?: number
  capabilities?: string[]
}

export interface ModelsResponse {
  models: AvailableModel[]
}

export interface SwitchModelRequest {
  model: string
  reason: string
}

export interface SwitchModelSuccessResponse {
  success: true
  model: string
  previousModel?: string
}

export interface SwitchModelErrorResponse {
  success: false
  error: string
  message: string
  availableModels: AvailableModel[]
}

export type SwitchModelResponse = SwitchModelSuccessResponse | SwitchModelErrorResponse

export interface CcrConfig {
  baseUrl: string
  apiKey?: string
  modelSwitchingEnabled: boolean
  orchestraEnabled: boolean
}
