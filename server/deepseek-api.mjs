/**
 * Local OpenAI-compatible proxy for DeepSeek.
 * Env:
 *   DEEPSEEK_API_KEY   — required for live LLM (never commit)
 *   DEEPSEEK_BASE_URL  — default https://api.deepseek.com
 *   DEEPSEEK_MODEL     — default deepseek-chat
 *   PORT               — default 8787
 *
 * Without a key, /api/llm/status reports available:false; UI stays on rules.
 */
import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(
  /\/$/,
  '',
);
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function chatCompletions(messages, { temperature = 0.2, json = false } = {}) {
  if (!API_KEY) {
    const err = new Error('DEEPSEEK_API_KEY not set');
    err.status = 503;
    throw err;
  }
  const url = `${BASE_URL}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`DeepSeek HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function handleEval(body) {
  const { trigger, rules = [], mode } = body;
  const system = `You are the Router eval module of a Super-agent.
Decide whether to accept a trigger as work for a Worker.
Return JSON: {"wouldAccept":boolean,"reason":string,"matchedRuleIds":string[]}
Rules (prefer matching these ids when relevant): ${JSON.stringify(rules)}
Mode is "${mode}". Only set wouldAccept true if the event is actionable and valuable; ignore noise/chatter/newsletters.
Be concise. reason in Chinese.`;

  const user = JSON.stringify(trigger ?? {});
  const raw = await chatCompletions(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { json: true },
  );

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      wouldAccept: false,
      reason: `LLM 返回无法解析：${raw.slice(0, 120)}`,
      matchedRuleIds: [],
    };
  }
  return {
    wouldAccept: Boolean(parsed.wouldAccept),
    reason: String(parsed.reason || 'LLM 评估'),
    matchedRuleIds: Array.isArray(parsed.matchedRuleIds)
      ? parsed.matchedRuleIds.map(String)
      : [],
    raw,
  };
}

async function handleAssist(body) {
  const { taskTitle, context, step } = body;
  const raw = await chatCompletions([
    {
      role: 'system',
      content:
        'You help a Super-agent Worker write a short Chinese delivery summary (≤80 chars) for the human via the Router. No markdown.',
    },
    {
      role: 'user',
      content: `task: ${taskTitle}\nstep: ${step}\ncontext:\n${context}`,
    },
  ]);
  return { text: raw.trim() };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/llm/status') {
      return sendJson(res, 200, {
        available: Boolean(API_KEY),
        model: API_KEY ? MODEL : null,
        baseUrlConfigured: Boolean(process.env.DEEPSEEK_BASE_URL || API_KEY),
        message: API_KEY
          ? `DeepSeek ready (${MODEL} @ ${BASE_URL})`
          : 'DEEPSEEK_API_KEY 未设置 — 离线规则模式。复制 .env.example 为 .env 后填写密钥，再 pnpm dev:api',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/llm/eval') {
      if (!API_KEY) {
        return sendJson(res, 503, { error: 'DEEPSEEK_API_KEY not set' });
      }
      const body = await readBody(req);
      const result = await handleEval(body);
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/api/llm/assist') {
      if (!API_KEY) {
        return sendJson(res, 503, { error: 'DEEPSEEK_API_KEY not set' });
      }
      const body = await readBody(req);
      const result = await handleAssist(body);
      return sendJson(res, 200, result);
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (e) {
    sendJson(res, e.status || 500, {
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[deepseek-api] http://127.0.0.1:${PORT}  key=${API_KEY ? 'set' : 'MISSING'}  model=${MODEL}`,
  );
});
