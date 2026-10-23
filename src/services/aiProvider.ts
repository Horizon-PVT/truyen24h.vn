/**
 * Unified AI Provider Service
 *
 * Supports multi-model switching between:
 *   1. Google Gemini (@google/genai)
 *   2. DeepSeek (DeepSeek-V3 / DeepSeek-R1) via OpenAI-compatible API
 *   3. SiliconFlow (Qwen 2.5 / DeepSeek) via OpenAI-compatible API
 *   4. OpenRouter (DeepSeek Free / Llama / etc.) via OpenAI-compatible API
 *
 * Configured via environment variables:
 *   AI_PROVIDER = 'gemini' | 'deepseek' | 'siliconflow' | 'openrouter' (default: 'gemini')
 *   DEEPSEEK_API_KEY = 'sk-...'
 *   SILICONFLOW_API_KEY = 'sk-...'
 *   OPENROUTER_API_KEY = 'sk-...'
 */

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  modelOverride?: string;
}

export interface GenerateTextResult {
  text: string;
  provider: string;
  model: string;
}

export function getActiveProvider(): 'gemini' | 'deepseek' | 'siliconflow' | 'openrouter' {
  const p = (process.env.AI_PROVIDER || '').toLowerCase().trim();
  if (p === 'deepseek' || p === 'siliconflow' || p === 'openrouter') return p;
  return 'gemini';
}

/**
 * Standard OpenAI-compatible API caller (native fetch, zero extra dependencies).
 */
async function callOpenAICompatible(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  extraHeaders?: Record<string, string>;
}): Promise<string> {
  const messages: { role: string; content: string }[] = [];

  if (opts.systemInstruction) {
    messages.push({ role: 'system', content: opts.systemInstruction });
  }

  messages.push({ role: 'user', content: opts.prompt });

  const body: Record<string, any> = {
    model: opts.model,
    messages,
    temperature: opts.temperature ?? 0.7,
  };

  if (opts.maxTokens) {
    body.max_tokens = opts.maxTokens;
  }

  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const endpoint = opts.baseUrl.endsWith('/')
    ? `${opts.baseUrl}chat/completions`
    : `${opts.baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${opts.apiKey}`,
    ...(opts.extraHeaders || {}),
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI Provider HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content || '';
  return content.trim();
}

/**
 * Primary text generation dispatcher.
 */
export async function generateAIText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const provider = getActiveProvider();

  // 1. DeepSeek Official Provider
  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not set in environment.');
    }
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    const model = options.modelOverride || 'deepseek-chat';
    const text = await callOpenAICompatible({
      baseUrl,
      apiKey,
      model,
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
    });
    return { text, provider: 'deepseek', model };
  }

  // 2. SiliconFlow Provider (Qwen 2.5 / DeepSeek V3 / R1)
  if (provider === 'siliconflow') {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      throw new Error('SILICONFLOW_API_KEY is not set in environment.');
    }
    const baseUrl = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    const model = options.modelOverride || 'deepseek-ai/DeepSeek-V3';
    const text = await callOpenAICompatible({
      baseUrl,
      apiKey,
      model,
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
    });
    return { text, provider: 'siliconflow', model };
  }

  // 3. OpenRouter Provider (Free DeepSeek-chat / DeepSeek-R1 tiers)
  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set in environment.');
    }
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const model = options.modelOverride || 'deepseek/deepseek-chat:free';
    const text = await callOpenAICompatible({
      baseUrl,
      apiKey,
      model,
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
      extraHeaders: {
        'HTTP-Referer': 'https://truyen24h.vn',
        'X-Title': 'Truyen24h.vn',
      },
    });
    return { text, provider: 'openrouter', model };
  }

  // 4. Google Gemini Provider (Default)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment.');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const model = options.modelOverride || 'gemini-2.5-flash';

  const config: Record<string, any> = {};
  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }
  if (options.temperature !== undefined) {
    config.temperature = options.temperature;
  }
  if (options.jsonMode) {
    config.responseMimeType = 'application/json';
  }

  const response = await ai.models.generateContent({
    model,
    contents: options.prompt,
    config,
  });

  return {
    text: response.text || '',
    provider: 'gemini',
    model,
  };
}
