/**
 * CCR model switching tool for DSH
 *
 * TODO: Full integration with DSH tool system pending.
 * This module provides the client and types needed for integration.
 */

import { CcrClient } from './client.ts'
import type { CcrConfig } from './types.ts'

/**
 * Tool definition schema for ccr_switch_model
 * This can be used to register the tool with DSH's tool runtime
 */
export const CCR_SWITCH_MODEL_TOOL_SCHEMA = {
  name: 'ccr_switch_model',
  description:
    'Request CCR to switch the current model to a specific one. ' +
    'If the model is not found, returns the list of available models. ' +
    'Use this when you need capabilities of a different model ' +
    '(e.g., larger context, better reasoning, vision support).',
  parameters: {
    model: {
      type: 'string',
      description:
        "The model ID to switch to (e.g., 'openai/gpt-5.6-sol', 'anthropic/claude-opus-5')",
    },
    reason: {
      type: 'string',
      description: 'Explanation of why this model switch is needed',
    },
  },
  required: ['model', 'reason'],
} as const

/**
 * Execute model switch
 * This function can be wrapped in a DSH tool executor
 */
export async function executeCcrModelSwitch(
  args: { model: string; reason: string },
  config: CcrConfig,
  sessionId?: string,
): Promise<{ success: boolean; message: string; error?: string }> {
  const client = new CcrClient(config, 'dsh', sessionId)

  try {
    const response = await client.switchModel(args.model, args.reason)

    if (response.success) {
      const previous = response.previousModel
        ? ` (previous: ${response.previousModel})`
        : ''
      return {
        success: true,
        message: `Successfully switched to model ${response.model}${previous}`,
      }
    } else {
      const modelList = response.availableModels
        .map(m => `- ${m.id}: ${m.displayName}`)
        .join('\n')
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
