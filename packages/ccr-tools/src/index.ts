/**
 * CCR Tools for DeepSeek Harness
 *
 * Provides tools for model switching, budget tracking, and orchestra management
 */

export { CcrClient } from './client.ts'
export type * from './types.ts'

export {
  CCR_SWITCH_MODEL_TOOL_SCHEMA,
  CCR_GET_BUDGET_TOOL_SCHEMA,
  CCR_BUDGET_CONFIRM_TOOL_SCHEMA,
  CCR_LIST_MODELS_TOOL_SCHEMA,
  CCR_TOOLS,
  executeCcrModelSwitch,
  executeCcrGetBudget,
  executeCcrBudgetConfirm,
  executeCcrListModels,
} from './tool.ts'
