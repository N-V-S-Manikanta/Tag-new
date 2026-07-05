// Claude (Anthropic) API client for the built-in assistant. The API key lives
// ONLY in the backend environment (ANTHROPIC_API_KEY) — it is never sent to the
// browser, logged, or committed. Uses plain fetch so no extra dependency.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export const hasKey = () => !!process.env.ANTHROPIC_API_KEY;
export const modelName = () => process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

// One turn against the Messages API. `messages` may contain tool_use /
// tool_result blocks from previous iterations of the agent loop.
export const complete = async ({ system, messages, tools, maxTokens = 1500 }) => {
  if (!hasKey()) {
    const err = new Error('AI assistant is not configured');
    err.code = 'NO_KEY';
    throw err;
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: modelName(), max_tokens: maxTokens, system, messages, tools }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Anthropic API error (${res.status})`);
    err.status = res.status;
    err.code = res.status === 401 ? 'BAD_KEY' : res.status === 429 ? 'RATE_LIMIT' : 'API_ERROR';
    throw err;
  }
  return data;
};
