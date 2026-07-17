// Claude (Anthropic) API client for the built-in assistant. The API key lives
// ONLY in the backend environment (ANTHROPIC_API_KEY) — it is never sent to the
// browser, logged, or committed. Uses plain fetch so no extra dependency.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export const hasKey = () => !!process.env.ANTHROPIC_API_KEY;
export const modelName = () => process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

// One turn against the Messages API. `messages` may contain tool_use /
// tool_result blocks from previous iterations of the agent loop. Pass
// `toolChoice` to force a specific tool — used to get structured output
// (e.g. a drafted caption) back as validated tool input instead of free text.
// Pass `cache: true` to prompt-cache the request prefix: the first call writes
// the cache (1.25x), every reuse within 5 minutes reads it at ~0.1x. We place a
// breakpoint on the system prompt (caches tools + system) AND a rolling one on
// the last message — so a multi-round tool conversation caches the whole prefix
// each round and the next round reads it back. Caching only engages once the
// prefix clears the model's minimum cacheable length (~4k tokens on Haiku 4.5),
// which is exactly when tool results have made the conversation worth caching.
const addCacheControl = (block) => ({ ...block, cache_control: { type: 'ephemeral' } });
const markLastBlock = (messages) => {
  if (!Array.isArray(messages) || !messages.length) return messages;
  const out = messages.slice();
  const last = { ...out[out.length - 1] };
  if (typeof last.content === 'string') {
    last.content = [addCacheControl({ type: 'text', text: last.content })];
  } else if (Array.isArray(last.content) && last.content.length) {
    last.content = last.content.map((b, i) => (i === last.content.length - 1 ? addCacheControl(b) : b));
  }
  out[out.length - 1] = last;
  return out;
};

export const complete = async ({ system, messages, tools, toolChoice, cache = false, maxTokens = 1500 }) => {
  if (!hasKey()) {
    const err = new Error('AI assistant is not configured');
    err.code = 'NO_KEY';
    throw err;
  }
  let sys = system;
  let msgs = messages;
  if (cache) {
    if (typeof system === 'string' && system) sys = [addCacheControl({ type: 'text', text: system })];
    msgs = markLastBlock(messages);
  }
  const body = { model: modelName(), max_tokens: maxTokens, system: sys, messages: msgs, tools };
  if (toolChoice) body.tool_choice = toolChoice;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
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
