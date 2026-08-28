export class ApiScanner {
  constructor(storage) {
    this.storage = storage;
  }

  // تست سریع سلامت و دسترسی مدل
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
          return { model: modelId, status: "OK", code: 200, message: "فعال و در دسترس ✅" };
        } else if (res.status === 429) {
          return { model: modelId, status: "RATE_LIMITED", code: 429, message: "رایگان / دارای محدودیت مصرف ⏳" };
        } else if (res.status === 401 || res.status === 403) {
          return { model: modelId, status: "UNAUTHORIZED", code: res.status, message: "پولی یا بدون مجوز دسترسی ❌" };
        } else {
          return { model: modelId, status: "ERROR", code: res.status, message: `خطای ${res.status}` };
        }
      } catch (err) {
        return { model: modelId, status: "NETWORK_ERROR", code: 0, message: err.message };
      }
    }

    return { model: modelId, status: "UNKNOWN", code: 0, message: "نوع API پشتیبانی نمی‌شود" };
  }

  // اسکن لیست مدل‌های متصل
  async scanAll(modelsList) {
    const geminiKey = await this.storage.getGeminiKey();
    if (!geminiKey) return { success: false, error: "کلید Gemini تنظیم نشده است." };

    const results = [];
    for (const m of modelsList) {
      const res = await this.testModel(m.id || m, geminiKey);
      results.push(res);
    }
    return { success: true, results };
  }
}
