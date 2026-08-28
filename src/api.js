import { CONFIG } from './config.js';

export async function callAI(messages, config, systemPrompt, enableSearch = true) {
  const { model, storage } = config;
  const geminiKey = await storage.getGeminiKey();

  if (!geminiKey) {
    throw new Error("کلید Gemini تنظیم نشده است.");
  }

  // چیدمان دقیق زنجیره مدل‌ها بر اساس اولویت کاربر
  const primary = model || CONFIG.DEFAULT_FALLBACK_CHAIN[0];
  const candidateModels = [
    primary,
    ...CONFIG.DEFAULT_FALLBACK_CHAIN.filter(m => m !== primary)
  ];

  const uniqueModels = [...new Set(candidateModels)];

  let lastError = null;

  for (const targetModel of uniqueModels) {
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

    if (enableSearch && !cleanModel.includes("gemma")) {
      payload.tools = [{ googleSearch: {} }];
    }

    if (systemPrompt) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (text) {
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
          return { text, sources, modelUsed: cleanModel };
        }
      }

      // در صورت خطای ابزار سرچ، تلاش بدون سرچ روی همان مدل
      if (enableSearch) {
        delete payload.tools;
        const retryRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return { text, sources: [], modelUsed: cleanModel };
        }
      }

      const errText = await res.text();
      lastError = `${cleanModel}: ${res.status}`;
      continue;
    } catch (netErr) {
      lastError = netErr.message;
      continue;
    }
  }

  throw new Error(`خطای ارتباط با هوش مصنوعی (${lastError})`);
}

export async function callVision(imageDataUri, userPrompt, config, systemPrompt) {
  const { storage } = config;
  const geminiKey = await storage.getGeminiKey();
  if (!geminiKey) throw new Error("کلید Gemini تنظیم نشده است.");

  const candidateModels = CONFIG.DEFAULT_FALLBACK_CHAIN;
  const matches = imageDataUri.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!matches) throw new Error("فرمت تصویر نامعتبر است.");

  for (const targetModel of candidateModels) {
    const cleanModel = targetModel.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${geminiKey}`;

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

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "تحلیل تصویر ناموفق بود.";
      }
      continue;
    } catch (e) {
      continue;
    }
  }

  throw new Error("تحلیل تصویر ناموفق بود.");
}
