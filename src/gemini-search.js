import { ModelManager } from './model-manager.js';

export class GeminiSearchService {
  constructor(storage) {
    this.storage = storage;
    this.modelManager = new ModelManager(storage);
  }

  async searchWithGrounding(query, modelId = null) {
    const apiKey = await this.storage.getGeminiKey();
    if (!apiKey) {
      return { success: false, error: "کلید API برای Gemini تنظیم نشده است." };
    }

    // انتخاب هوشمند سریع‌ترین مدل برای سرچ در صورت عدم تعیین مدل
    const targetModel = modelId || await this.modelManager.getFastSearchModel();

    // نرمال‌سازی مدل و حذف پیشوند models/
    const cleanModel = targetModel.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: query }]
        }
      ],
      tools: [
        {
          google_search: {}
        }
      ]
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, status: res.status, error: errorText };
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || "";

      // استخراج منابع وب مستند
      const sources = [];
      const metadata = candidate?.groundingMetadata;
      if (metadata?.groundingChunks) {
        for (const chunk of metadata.groundingChunks) {
          if (chunk.web?.uri) {
            sources.push({
              title: chunk.web.title || "منبع وب",
              url: chunk.web.uri
            });
          }
        }
      }

      return {
        success: true,
        modelUsed: cleanModel,
        text,
        sources
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}
