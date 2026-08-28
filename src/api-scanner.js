import { CONFIG } from './config.js';

export class ApiScanner {
  constructor(storage) {
    this.storage = storage;
  }

  // تست سریع سلامت و دسترسی یک مدل خاص
  async testModel(modelId, apiKey, baseUrl = "https://generativelanguage.googleapis.com/v1beta") {
    const cleanModel = modelId.replace(/^models\//, "");
    
    if (baseUrl.includes("googleapis.com")) {
      const url = `${baseUrl}/models/${cleanModel}:generateContent?key=${apiKey}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Ping" }] }]
          })
        });

        if (res.status === 200) {
          return { model: modelId, cleanId: cleanModel, status: "OK", isFree: true, code: 200, message: "فعال و در دسترس ✅" };
        } else if (res.status === 429) {
          return { model: modelId, cleanId: cleanModel, status: "RATE_LIMITED", isFree: true, code: 429, message: "رایگان / فعال با محدودیت نرخ (429) ⏳" };
        } else if (res.status === 401 || res.status === 403) {
          return { model: modelId, cleanId: cleanModel, status: "UNAUTHORIZED", isFree: false, code: res.status, message: "پولی یا نیازمند اشتراک ویژه ❌" };
        } else {
          return { model: modelId, cleanId: cleanModel, status: "ERROR", isFree: false, code: res.status, message: `خطای ${res.status}` };
        }
      } catch (err) {
        return { model: modelId, cleanId: cleanModel, status: "NETWORK_ERROR", isFree: false, code: 0, message: err.message };
      }
    }

    return { model: modelId, cleanId: modelId, status: "UNKNOWN", isFree: false, code: 0, message: "نوع API پشتیبانی نمی‌شود" };
  }

  // دریافت زنده لیست تمام مدل‌های موجود از Google AI Studio
  async fetchLiveGoogleModels(apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.models) return [];

      // فیلتر کردن مدل‌هایی که از متد generateContent پشتیبانی می‌کنند
      return data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
        .map(m => ({
          id: m.name.replace(/^models\//, ""),
          name: `✨ ${m.displayName || m.name}`,
          description: m.description || ""
        }));
    } catch (e) {
      return [];
    }
  }

  // اسکن کامل زنده: دریافت لیست از گوگل + تست تک‌تک مدل‌ها + شناسایی و ثبت خودکار مدل‌های رایگان جدید در KV
  async autoDiscoverAndScan() {
    const geminiKey = await this.storage.getGeminiKey();
    if (!geminiKey) return { success: false, error: "کلید Gemini تنظیم نشده است. از دستور /setgemini استفاده کنید." };

    // ۱. دریافت لیست زنده تمام مدل‌های ارائه شده توسط گوگل
    const liveGoogleModels = await this.fetchLiveGoogleModels(geminiKey);
    
    // ادغام با لیست پیش‌فرض کانفیگ
    const candidateMap = new Map();
    CONFIG.GEMINI_MODELS.forEach(m => candidateMap.set(m.id, { id: m.id, name: m.name }));
    liveGoogleModels.forEach(m => {
      if (!candidateMap.has(m.id)) {
        candidateMap.set(m.id, { id: m.id, name: m.name });
      }
    });

    const allCandidates = Array.from(candidateMap.values());

    // ۲. تست همزمان مدل‌ها و تفکیک مدل‌های رایگان و در دسترس
    const testPromises = allCandidates.map(c => this.testModel(c.id, geminiKey));
    const results = await Promise.all(testPromises);

    const freeModels = [];
    const newlyDiscovered = [];

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const candidate = allCandidates[i];

      if (res.isFree) {
        freeModels.push({
          id: candidate.id,
          name: candidate.name,
          status: res.message
        });

        // آیا این مدل جدیداً اضافه شده و در کانفیگ پایه نبوده؟
        const isBuiltIn = CONFIG.GEMINI_MODELS.some(m => m.id === candidate.id);
        if (!isBuiltIn) {
          newlyDiscovered.push({ id: candidate.id, name: candidate.name });
        }
      }
    }

    // ۳. ذخیره خودکار مدل‌های کشف‌شده جدید در KV Storage
    if (this.storage.kv && freeModels.length > 0) {
      await this.storage.kv.put("config:discovered_models", JSON.stringify(freeModels));
    }

    return {
      success: true,
      totalScanned: allCandidates.length,
      freeModels,
      newlyDiscovered,
      allResults: results
    };
  }
}
