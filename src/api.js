import { CONFIG } from './config.js';

export async function callAI(messages, config, systemPrompt, enableSearch = true) {
  const { model, storage } = config;
  const targetModel = model || "gemini-2.5-flash";
  const geminiKey = await storage.getGeminiKey();

  const isGoogleModel = /^(gemini|gemma|deep-research|antigravity|robotics)/i.test(targetModel.replace(/^models\//, ''));

  if (isGoogleModel) {
    if (!geminiKey) {
      throw new Error("کلید Gemini تنظیم نشده است.");
    }

    const cleanModel = targetModel.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${geminiKey}`;

    const formattedContents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const payload = {
      contents: formattedContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    // فعال‌سازی ابزار جستجوی گوگل در تک‌مرحله برای پاسخ‌دهی فوق‌سریع
    if (enableSearch && !cleanModel.includes("gemma")) {
      payload.tools = [{ google_search: {} }];
    }

    if (systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      // اگر خطایی در ابزار سرچ رخ داد، تلاش مجدد بدون ابزار
      if (enableSearch) {
        return callAI(messages, config, systemPrompt, false);
      }
      const errorText = await res.text();
      throw new Error(`خطای Gemini (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || "پاسخی دریافت نشد.";

    // استخراج فوری منابع Grounding در همان تک‌فراخوانی
    const sources = [];
    const metadata = candidate?.groundingMetadata;
    if (metadata?.groundingChunks) {
      for (const chunk of metadata.groundingChunks) {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || "منبع",
            url: chunk.web.uri
          });
        }
      }
    }

    return { text, sources };
  }

  // سایر مدل‌های سازگار با OpenAI
  const customApisRaw = await storage.kv?.get(`apis:custom`) || "[]";
  const customApis = JSON.parse(customApisRaw);
  const activeApi = customApis[0];

  if (!activeApi) {
    throw new Error("API برای این مدل یافت نشد.");
  }

  const endpoint = `${activeApi.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const formattedOpenAIMessages = [];
  if (systemPrompt) formattedOpenAIMessages.push({ role: "system", content: systemPrompt });
  for (const m of messages) formattedOpenAIMessages.push({ role: m.role, content: m.content });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${activeApi.key}`
    },
    body: JSON.stringify({
      model: targetModel,
      messages: formattedOpenAIMessages
    })
  });

  if (!res.ok) throw new Error(`خطای API: ${res.status}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || "پاسخی دریافت نشد.",
    sources: []
  };
}

export async function callVision(imageDataUri, userPrompt, config, systemPrompt) {
  const { model, storage } = config;
  const targetModel = model || "gemini-2.5-flash";
  const geminiKey = await storage.getGeminiKey();

  if (!geminiKey) throw new Error("کلید Gemini تنظیم نشده است.");

  const cleanModel = targetModel.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${geminiKey}`;

  const matches = imageDataUri.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!matches) throw new Error("فرمت تصویر نامعتبر است.");

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: matches[1], data: matches[2] } },
          { text: userPrompt || "این تصویر را تحلیل و متون آن را بخوان." }
        ]
      }
    ]
  };

  if (systemPrompt) {
    payload.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`خطا: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "تحلیل تصویر ناموفق بود.";
}
