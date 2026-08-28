import { CONFIG } from './config.js';

export async function callAI(messages, config, systemPrompt) {
  const { model, storage } = config;
  const targetModel = model || CONFIG.GEMINI_MODELS[0].id;
  const geminiKey = await storage.getGeminiKey();

  // اگر مدل از مدل‌های Google Gemini / Deep Research / Gemma باشد
  const isGoogleModel = /^(gemini|gemma|deep-research|antigravity|robotics)/i.test(targetModel.replace(/^models\//, ''));

  if (isGoogleModel) {
    if (!geminiKey) {
      throw new Error("کلید Gemini تنظیم نشده است. از دستور /setgemini استفاده کنید.");
    }

    const cleanModel = targetModel.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${geminiKey}`;

    const formattedContents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const payload = {
      contents: formattedContents
    };

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
      const errorText = await res.text();
      throw new Error(`خطای Gemini API (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "پاسخی از مدل دریافت نشد.";
  }

  // برای سایر مدل‌های سازگار با OpenAI
  const customApisRaw = await storage.kv?.get(`apis:custom`) || "[]";
  const customApis = JSON.parse(customApisRaw);
  const activeApi = customApis[0];

  if (!activeApi) {
    throw new Error("هیچ API سازگار با مدل انتخابی یافت نشد.");
  }

  const endpoint = `${activeApi.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const formattedOpenAIMessages = [];
  if (systemPrompt) {
    formattedOpenAIMessages.push({ role: "system", content: systemPrompt });
  }
  for (const m of messages) {
    formattedOpenAIMessages.push({ role: m.role, content: m.content });
  }

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

  if (!res.ok) {
    throw new Error(`خطای API (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "پاسخی دریافت نشد.";
}

export async function callVision(imageDataUri, userPrompt, config, systemPrompt) {
  const { model, storage } = config;
  const targetModel = model || "gemini-2.5-flash";
  const geminiKey = await storage.getGeminiKey();

  if (!geminiKey) {
    throw new Error("کلید Gemini برای تحلیل تصویر تنظیم نشده است.");
  }

  const cleanModel = targetModel.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${geminiKey}`;

  // جداسازی mimeType و دیتای خالص base64
  const matches = imageDataUri.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("فرمت تصویر ارسالی نامعتبر است.");
  }
  const mimeType = matches[1];
  const base64Data = matches[2];

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: userPrompt || "این تصویر را به طور کامل تحلیل و تمام متن‌های آن را به فارسی روان بازگو کن."
          }
        ]
      }
    ]
  };

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
    throw new Error(`خطای تحلیل تصویر (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "تحلیل تصویر با مشکل مواجه شد.";
}
