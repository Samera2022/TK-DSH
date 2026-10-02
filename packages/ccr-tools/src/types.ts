/**
 * CCR Tools type definitions
 */

export interface CcrConfig {
  baseUrl?: string
  apiKey?: string
  modelSwitchingEnabled?: boolean
  orchestraEnabled?: boolean
}

export interface AvailableModel {
  id: string
  displayName: string
  provider: string
  contextTokens?: number
  capabilities?: string[]
}

export interface SwitchModelRequest {
  model: string
  reason: string
}

export interface SwitchModelResponse {
  success: boolean
  model?: string
  previousModel?: string
  error?: string
  message?: string
  availableModels?: AvailableModel[]
}

export interface BudgetState {
  model: string
  budget: number
  used: number
  remaining: number
  percentage: number
}

export interface BudgetConfirmationRequest {
  model: string
  currentUsage: number
  budgetLimit: number
  taskContext?: string
}

export type BudgetConfirmationResponse =
  | { action: 'continue' }
  | { action: 'switch'; targetModel: string }
  | { action: 'stop' }

export interface OrchestraConfig {
  enabled: boolean
  defaultOrchestratorModel: string
  roles: Role[]
}

export interface Role {
  name: string
  model: string
  systemPrompt: string
  triggers: string[]
  budget?: number
}
