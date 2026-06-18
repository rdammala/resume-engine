/**
 * engine/llm.js
 *
 * Swappable LLM abstraction layer.
 * Switch providers by changing config.json → llm.provider, or pass
 * --llm=openai on the CLI. No code changes needed.
 *
 * Providers:
 *   ollama    — free, fully offline (default)
 *   openai    — gpt-4o-mini (~$0.02–$0.08/application)
 *   anthropic — claude-haiku
 *   gemini    — gemini-1.5-flash (has free tier)
 */

'use strict';

const https = require('https');
const http  = require('http');

// ---------------------------------------------------------------------------
// PUBLIC
// ---------------------------------------------------------------------------

/**
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} config  — parsed config.json
 * @returns {Promise<string>}
 */
async function call(systemPrompt, userPrompt, config) {
  const provider = config.llm.provider;
  const cfg = config.llm.providers[provider];

  if (!cfg) {
    throw new Error(`[llm] Unknown provider "${provider}". Check config.json.`);
  }

  console.log(`[llm] Using provider: ${provider} (${cfg.model || cfg.baseUrl})`);

  switch (provider) {
    case 'ollama':    return callOllama(systemPrompt, userPrompt, cfg);
    case 'openai':    return callOpenAI(systemPrompt, userPrompt, cfg);
    case 'anthropic': return callAnthropic(systemPrompt, userPrompt, cfg);
    case 'gemini':    return callGemini(systemPrompt, userPrompt, cfg);
    default:
      throw new Error(`[llm] Provider "${provider}" not implemented.`);
  }
}

// ---------------------------------------------------------------------------
// OLLAMA  (local, free)
// ---------------------------------------------------------------------------

async function callOllama(system, user, cfg) {
  const body = JSON.stringify({
    model: cfg.model,
    prompt: `${system}\n\n${user}`,
    stream: false,
  });

  const url = new URL('/api/generate', cfg.baseUrl);
  const text = await httpPost(url, body, {});

  try {
    return JSON.parse(text).response || text;
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// OPENAI
// ---------------------------------------------------------------------------

async function callOpenAI(system, user, cfg) {
  const apiKey = process.env[cfg.apiKeyEnvVar];
  if (!apiKey) throw new Error(`[llm] Set ${cfg.apiKeyEnvVar} environment variable for OpenAI.`);

  const body = JSON.stringify({
    model: cfg.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    temperature: 0.7,
  });

  const url = new URL('https://api.openai.com/v1/chat/completions');
  const text = await httpPost(url, body, {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  });

  const json = JSON.parse(text);
  return json.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// ANTHROPIC
// ---------------------------------------------------------------------------

async function callAnthropic(system, user, cfg) {
  const apiKey = process.env[cfg.apiKeyEnvVar];
  if (!apiKey) throw new Error(`[llm] Set ${cfg.apiKeyEnvVar} environment variable for Anthropic.`);

  const body = JSON.stringify({
    model: cfg.model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const url = new URL('https://api.anthropic.com/v1/messages');
  const text = await httpPost(url, body, {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  });

  const json = JSON.parse(text);
  return json.content[0].text;
}

// ---------------------------------------------------------------------------
// GEMINI
// ---------------------------------------------------------------------------

async function callGemini(system, user, cfg) {
  const apiKey = process.env[cfg.apiKeyEnvVar];
  if (!apiKey) throw new Error(`[llm] Set ${cfg.apiKeyEnvVar} environment variable for Gemini.`);

  const body = JSON.stringify({
    contents: [{
      parts: [{ text: `${system}\n\n${user}` }]
    }],
    generationConfig: { temperature: 0.7 },
  });

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${apiKey}`
  );
  const text = await httpPost(url, body, { 'Content-Type': 'application/json' });

  const json = JSON.parse(text);
  return json.candidates[0].content.parts[0].text;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function httpPost(url, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders,
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`[llm] HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { call };
