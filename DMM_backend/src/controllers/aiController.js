import asyncHandler from 'express-async-handler';
import { hasKey, modelName, complete } from '../services/aiService.js';
import { TOOL_DEFINITIONS, runTool } from '../services/aiTools.js';

// Human label for the role names used across the platform.
const roleLabel = (user) =>
  user.role === 'ADMIN' ? 'Super Admin' : user.role === 'CEO' ? 'Admin — head of their organization' : 'User — content creator';

const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY = 20;

const systemPrompt = (user) => `You are the built-in assistant of "t@g", a digital-marketing management platform used by the Nagarjuna group of institutions (engineering, management, degree and PU colleges) and partner organizations to run their social media.

The person talking to you is ${user.name} (${roleLabel(user)}${user.organization?.name ? `, organization: ${user.organization.name}` : ''}). Today's date is ${new Date().toISOString().slice(0, 10)}.

You have read-only tools over the platform's LIVE database: organizations, social media analytics (LinkedIn, Instagram, YouTube, Facebook), growth goals, content approvals and post plans.

Rules:
- ALWAYS use tools to answer questions about data — never invent numbers. If a tool returns no data, say so plainly.
- Write numbers in full with thousands separators (e.g. 11,148 — never "11k").
- Be concise and direct: answer first, then at most a few supporting points. Use short bullet lists or compact tables when comparing.
- If an organization name is ambiguous or unknown, check list_organizations before answering.
- You cannot create, edit, approve or delete anything yet — if asked to, explain the steps to do it in the app instead (e.g. "Post Planner page → New plan").
- Only discuss this platform and the marketing work around it. Politely decline unrelated requests.`;

// @route GET /api/ai/status — is the assistant configured? (never exposes the key)
export const aiStatus = asyncHandler(async (req, res) => {
  res.json({ success: true, configured: hasKey(), model: hasKey() ? modelName() : null });
});

// @route POST /api/ai/chat — { messages: [{ role: 'user'|'assistant', content: string }] }
// Runs an agentic loop: the model may call data tools, we execute them and feed
// results back until it produces a final text answer.
export const aiChat = asyncHandler(async (req, res) => {
  if (!hasKey()) {
    res.status(503);
    throw new Error('AI assistant is not configured yet — add ANTHROPIC_API_KEY to the backend .env');
  }
  const history = Array.isArray(req.body.messages) ? req.body.messages : [];
  const clean = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!clean.length || clean[clean.length - 1].role !== 'user') {
    res.status(400);
    throw new Error('Send at least one user message');
  }

  const messages = [...clean];
  const toolsUsed = [];
  let reply = '';

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const result = await complete({ system: systemPrompt(req.user), messages, tools: TOOL_DEFINITIONS });
      const toolCalls = (result.content || []).filter((b) => b.type === 'tool_use');
      const text = (result.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

      if (result.stop_reason !== 'tool_use' || !toolCalls.length || round === MAX_TOOL_ROUNDS) {
        reply = text || 'Sorry — I could not produce an answer. Please try rephrasing.';
        break;
      }

      messages.push({ role: 'assistant', content: result.content });
      const toolResults = await Promise.all(toolCalls.map(async (call) => {
        toolsUsed.push(call.name);
        const output = await runTool(call.name, call.input, req.user);
        return { type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(output) };
      }));
      messages.push({ role: 'user', content: toolResults });
    }
  } catch (err) {
    if (err.code === 'BAD_KEY') { res.status(503); throw new Error('The configured Anthropic API key was rejected — check ANTHROPIC_API_KEY in the backend .env'); }
    if (err.code === 'RATE_LIMIT') { res.status(429); throw new Error('The AI service is rate-limited right now — try again in a moment'); }
    throw err;
  }

  res.json({ success: true, reply, toolsUsed: [...new Set(toolsUsed)] });
});
