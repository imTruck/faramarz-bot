import { CONFIG } from './config.js';

export async function callAI(messages, config, systemPrompt, enableSearch = true) {
  const { model, storage } = config;
  const geminiKey = await storage.getGeminiKey();

  if (!geminiKey) {
    throw new Error("کلید Gemini تنظیم نشده است.");
  }

  // ساخت زنجیره اولویت‌بندی مدل‌ها برای سوییچ خودکار در صورت لیمیت
  const primary = model || CONFIG.DEFAULT_FALLBACK_CHAIN[0];
  const candidateModels = [primary, ...CONFIG.DEFAULT_FALLBACK_CHAIN.filter(m => m !== primary)];

  let lastError = null;

  for (const targetModel of candidateModels) {
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
      payload.tools = [{ google_search: {} }];
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
        const text = candidate?.content?.parts?.[0]?.text || "پاسخی دریافت نشد.";

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

      // در صورت بروز خطای لیمیت (429) یا خطای سروری (503, 500, 404)
      const errText = await res.text();
      lastError = `مدل ${cleanModel} خطا داد (${res.status}): ${errText}`;
      // ثبت در لاگ و تلاش با مدل بعدی در زنجیره
      if (storage?.addLog) {
        storage.addLog(`Failover: ${cleanModel} returned ${res.status}. Trying next model...`).catch(() => {});
      }
      continue;
    } catch (netErr) {
      lastError = netErr.message;
      continue;
    }
  }

  // اگر تمام مدل‌ها خطا دادند
  throw new Error(`تمام مدل‌های زنجیره با خطا مواجه شدند. آخرین خطا: ${lastError}`);
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

  throw new Error("تحلیل تصویر با تمام مدل‌ها با خطا مواجه شد.");
}
