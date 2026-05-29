// EdgeOne Pages Function - AI API Proxy
// 处理：DeepSeek/OpenRouter 对话、阿里云通义万相视频生成
// 运行在 EdgeOne 边缘节点，与前端同域，无 CORS 问题

const PROVIDERS = {
  openrouter: { baseUrl: "https://openrouter.ai/api/v1" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1" },
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // CORS 预检
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    // ===== 万相 API 代理 =====
    if (pathname === "/api/wanxiang/submit") {
      return await handleWanxiangSubmit(request);
    }
    if (pathname === "/api/wanxiang/query") {
      return await handleWanxiangQuery(request);
    }

    // ===== 聊天 API 代理 =====
    return await handleChatProxy(request);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

// ===== 万相：提交视频生成任务 =====
async function handleWanxiangSubmit(request) {
  const body = await request.json();
  const { apiKey, prompt, duration = 5, ratio = "9:16", imageUrl } = body;

  if (!apiKey || !prompt) {
    return jsonResponse({ error: "Missing apiKey or prompt" }, 400);
  }

  const payload = {
    model: imageUrl ? "wan2.7-i2v-2026-04-25" : "wan2.7-t2v-2026-04-25",
    input: { prompt },
    parameters: {
      resolution: "720P",
      ratio,
      duration: Math.max(2, Math.min(15, duration)),
      prompt_extend: true,
      watermark: false,
    },
  };
  if (imageUrl) {
    payload.input.media = [{ type: "first_frame", url: imageUrl }];
  }

  const response = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: corsHeaders(),
  });
}

// ===== 万相：查询任务结果 =====
async function handleWanxiangQuery(request) {
  const body = await request.json();
  const { apiKey, taskId } = body;

  if (!apiKey || !taskId) {
    return jsonResponse({ error: "Missing apiKey or taskId" }, 400);
  }

  const response = await fetch(
    `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
    { headers: { Authorization: `Bearer ${apiKey.trim()}` } }
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: corsHeaders(),
  });
}

// ===== 聊天 API 代理 =====
async function handleChatProxy(request) {
  const body = await request.json();
  const { provider, model, messages, key, max_tokens } = body;

  if (!provider || !model || !messages || !key) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return jsonResponse({ error: "Unknown provider" }, 400);
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://meiqiu9527.xyz";
    headers["X-Title"] = "AI短剧宇宙";
  }

  const response = await fetch(
    `${providerConfig.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: max_tokens || 2048,
        temperature: 0.7,
        stream: false,
      }),
    }
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: corsHeaders(),
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-DashScope-Async",
    "Content-Type": "application/json",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}
