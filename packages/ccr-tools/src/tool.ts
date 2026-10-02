/**
 * CCR tools for DSH - Model switching and budget management
 */

import { CcrClient } from './client.ts'
import type { CcrConfig } from './types.ts'

// ============================================================================
// Tool: ccr_switch_model
// ============================================================================

export const CCR_SWITCH_MODEL_TOOL_SCHEMA = {
  name: 'ccr_switch_model',
  description:
    'Request CCR to switch the current model to a specific one. ' +
    'If the model is not found, returns the list of available models. ' +
    'Use this when you need capabilities of a different model ' +
    '(e.g., larger context, better reasoning, vision support, cost optimization).',
  parameters: {
    model: {
      type: 'string',
      description:
        "The model ID to switch to (e.g., 'openai/gpt-5.6-sol', 'anthropic/claude-opus-5', 'deepseek/deepseek-v4')",
    },
    reason: {
      type: 'string',
      description:
        'Detailed explanation of why this model switch is needed. Be specific about what capability or feature you need.',
    },
  },
  required: ['model', 'reason'],
} as const

export async function executeCcrModelSwitch(
  args: { model: string; reason: string },
  config: CcrConfig,
  sessionId?: string,
): Promise<{ success: boolean; message: string; error?: string | undefined }> {
  const client = new CcrClient(config, 'dsh', sessionId)

  try {
    const response = await client.switchModel(args.model, args.reason)

    if (response.success) {
      const previous = response.previousModel ? ` (previous: ${response.previousModel})` : ''
      return {
        success: true,
        message: `Successfully switched to model ${response.model}${previous}`,
      }
    } else {
      const modelList = response.availableModels?.map(m => `- ${m.id}: ${m.displayName}`).join('\n') || ''
      return {
        success: false,
        message: `${response.message}\n\nAvailable models:\n${modelList}`,
        error: response.error,
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to switch model: ${error instanceof Error ? error.message : String(error)}`,
      error: 'execution_error',
    }
  }
}

// ============================================================================
// Tool: ccr_get_budget
// ============================================================================

export const CCR_GET_BUDGET_TOOL_SCHEMA = {
  name: 'ccr_get_budget',
  description:
    'Check the current token budget status for a specific model. ' +
    'Use this to monitor usage and decide if you need to switch to a more cost-effective model.',
  parameters: {
    model: {
      type: 'string',
      description: 'The model ID to check budget for',
    },
  },
  required: ['model'],
} as const

export async function executeCcrGetBudget(
  args: { model: string },
  config: CcrConfig,
  sessionId?: string,
): Promise<{ success: boolean; budget: any; message?: string | undefined; error?: string | undefined }> {
  const client = new CcrClient(config, 'dsh', sessionId)

  try {
    const state = await client.getBudgetState(args.model)
    return {
      success: true,
      budget: state,
      message: `Budget: ${state.used.toLocaleString()}/${state.budget.toLocaleString()} tokens (${state.percentage.toFixed(1)}% used)`,
    }
  } catch (error) {
    return {
      success: false,
      budget: null,
      message: `Failed to get budget: ${error instanceof Error ? error.message : String(error)}`,
      error: 'execution_error',
    }
  }
}

// ============================================================================
// Tool: ccr_budget_confirm
// ============================================================================

export const CCR_BUDGET_CONFIRM_TOOL_SCHEMA = {
  name: 'ccr_budget_confirm',
  description:
    'Respond to a budget limit warning from CCR. ' +
    'Choose to continue with the current model, switch to a cheaper alternative, or stop the task.',
  parameters: {
    action: {
      type: 'string',
      enum: ['continue', 'switch', 'stop'],
      description:
        "'continue' to keep using the current model, 'switch' to change to targetModel, 'stop' to halt execution",
    },
    model: {
      type: 'string',
      description: 'The model that triggered the budget warning',
    },
    targetModel: {
      type: 'string',
      description: "Required if action is 'switch'. The model to switch to.",
    },
  },
  required: ['action', 'model'],
} as const

export async function executeCcrBudgetConfirm(
  args: { action: 'continue' | 'switch' | 'stop'; model: string; targetModel?: string },
  config: CcrConfig,
  sessionId?: string,
): Promise<{ success: boolean; message: string; error?: string | undefined }> {
  const client = new CcrClient(config, 'dsh', sessionId)

  try {
    if (args.action === 'switch' && !args.targetModel) {
      return {
        success: false,
        message: "targetModel is required when action is 'switch'",
        error: 'invalid_args',
      }
    }

    const response = await client.respondToBudgetConfirmation(args.action, args.model, args.targetModel)
    return response
  } catch (error) {
    return {
      success: false,
      message: `Failed to confirm budget: ${error instanceof Error ? error.message : String(error)}`,
      error: 'execution_error',
    }
  }
}

// ============================================================================
// Tool: ccr_list_models
// ============================================================================

export const CCR_LIST_MODELS_TOOL_SCHEMA = {
  name: 'ccr_list_models',
  description: 'Get the list of all models available through CCR',
  parameters: {},
  required: [],
} as const

export async function executeCcrListModels(
  _args: Record<string, never>,
  config: CcrConfig,
  sessionId?: string,
): Promise<{ success: boolean; models?: any[]; message?: string | undefined; error?: string | undefined }> {
  const client = new CcrClient(config, 'dsh', sessionId)

  try {
    const models = await client.getModels()
    const modelList = models.map(m => `- ${m.id}: ${m.displayName} (${m.provider})`).join('\n')
    return {
      success: true,
      models,
      message: `Available models:\n${modelList}`,
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to list models: ${error instanceof Error ? error.message : String(error)}`,
      error: 'execution_error',
    }
  }
}

// ============================================================================
// Export all tools
// ============================================================================

export const CCR_TOOLS = [
  {
    schema: CCR_SWITCH_MODEL_TOOL_SCHEMA,
    execute: executeCcrModelSwitch,
  },
  {
    schema: CCR_GET_BUDGET_TOOL_SCHEMA,
    execute: executeCcrGetBudget,
  },
  {
    schema: CCR_BUDGET_CONFIRM_TOOL_SCHEMA,
    execute: executeCcrBudgetConfirm,
  },
  {
    schema: CCR_LIST_MODELS_TOOL_SCHEMA,
    execute: executeCcrListModels,
  },
] as const
