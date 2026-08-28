import { CONFIG } from './config.js';

export async function callAI(messages, config, systemPrompt, enableSearch = true) {
  const { model, storage } = config;
  const geminiKey = await storage.getGeminiKey();

  if (!geminiKey) {
    throw new Error("کلید Gemini در دسترس نیست.");
  }

  // مدل‌های فعال و زنده
  const provenModels = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro"
  ];

  const primary = model || provenModels[0];
  const candidateModels = [
    primary,
    ...provenModels.filter(m => m !== primary),
    ...CONFIG.DEFAULT_FALLBACK_CHAIN.filter(m => m !== primary && !provenModels.includes(m))
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
        
        // استخراج صحیح و کامل متن از تمام بخش‌های پاسخ (شامل متن‌های چندپارتی و خروجی‌های پس از فکر)
        const parts = candidate?.content?.parts || [];
        const textParts = parts.filter(p => typeof p.text === 'string').map(p => p.text.trim()).filter(Boolean);
        const text = textParts.join("\n\n");

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

      // در صورت بروز خطا در ابزار سرچ، تلاش بدون سرچ روی همان مدل
      if (enableSearch) {
        delete payload.tools;
        const retryRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          const candidate = data.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          const text = parts.filter(p => typeof p.text === 'string').map(p => p.text.trim()).filter(Boolean).join("\n\n");
          if (text) return { text, sources: [], modelUsed: cleanModel };
        }
      }

      const errText = await res.text();
      lastError = `${cleanModel} (${res.status}): ${errText.slice(0, 100)}`;
      continue;
    } catch (netErr) {
      lastError = netErr.message;
      continue;
    }
  }

  throw new Error(`خطای تولید پاسخ هوش مصنوعی: ${lastError}`);
}

export async function callVision(imageDataUri, userPrompt, config, systemPrompt) {
  const { storage } = config;
  const geminiKey = await storage.getGeminiKey();
  if (!geminiKey) throw new Error("کلید Gemini تنظیم نشده است.");

  const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
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
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const text = parts.filter(p => typeof p.text === 'string').map(p => p.text.trim()).filter(Boolean).join("\n\n");
        if (text) return text;
      }
      continue;
    } catch (e) {
      continue;
    }
  }

  throw new Error("تحلیل تصویر ناموفق بود.");
}
