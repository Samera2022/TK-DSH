# @deepseek-ai/ccr-tools

CCR (Claude Code Router) integration tools for DeepSeek Harness.

## Features

- **Model Switching Tool**: `ccr_switch_model` tool for dynamic model switching
- **Model Discovery**: Query available models from CCR
- **Session Management**: Track model preferences per session

## Installation

```bash
pnpm add @deepseek-ai/ccr-tools
```

## Usage

### Register the Tool

```typescript
import { ccrSwitchModelTool } from '@deepseek-ai/ccr-tools'

// Register with tool runtime
toolRuntime.register(ccrSwitchModelTool)
```

### Configure CCR

```typescript
import type { CcrConfig } from '@deepseek-ai/ccr-tools'

const ccrConfig: CcrConfig = {
  baseUrl: 'http://localhost:8788',
  apiKey: process.env.CCR_API_KEY,
  modelSwitchingEnabled: true,
  orchestraEnabled: false,
}

// Pass config in tool execution context
const context = {
  ccrConfig,
  ccrSessionId: 'session-123',
  // ... other context
}
```

### Use the CCR Client Directly

```typescript
import { CcrClient } from '@deepseek-ai/ccr-tools'

const client = new CcrClient(ccrConfig, 'dsh', 'session-123')

// Get available models
const models = await client.getModels()

// Switch model
const response = await client.switchModel(
  'openai/gpt-5.6-sol',
  'Need larger context for analysis'
)
```

## Environment Variables

- `CCR_BASE_URL`: CCR base URL (default: `http://localhost:8788`)
- `CCR_API_KEY`: CCR API key (optional)

## Tool Schema

```json
{
  "name": "ccr_switch_model",
  "description": "Request CCR to switch the current model...",
  "parameters": {
    "model": {
      "type": "string",
      "description": "The model ID to switch to"
    },
    "reason": {
      "type": "string",
      "description": "Explanation of why this model switch is needed"
    }
  },
  "required": ["model", "reason"]
}
```

## TODO

- [ ] Add tests
- [ ] Add budget tracking UI
- [ ] Add orchestra status display
- [ ] Integration with DSH agent loop
- [ ] Configuration management
