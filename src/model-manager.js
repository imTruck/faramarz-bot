import { CONFIG } from './config.js';

export class ModelManager {
  constructor(storage) {
    this.storage = storage;
  }

  // دریافت مدل اصلی فعلی
  async getPrimary() {
    return await this.storage.getPrimaryModel();
  }

  // تنظیم مدل اصلی
  async setPrimary(modelId) {
    if (!this.storage.kv) return false;
    await this.storage.kv.put("config:primary_model", modelId);
    return true;
  }

  // دریافت لیست Fallback ها
  async getFallbacks() {
    if (!this.storage.kv) return ["gemini-2.0-flash", "gemini-1.5-flash"];
    const raw = await this.storage.kv.get("config:fallback_models");
    return raw ? JSON.parse(raw) : ["gemini-2.0-flash", "gemini-1.5-flash"];
  }

  // افزودن مدل Fallback
  async addFallback(modelId) {
    if (!this.storage.kv) return;
    const fallbacks = await this.getFallbacks();
    if (!fallbacks.includes(modelId)) {
      fallbacks.push(modelId);
      await this.storage.kv.put("config:fallback_models", JSON.stringify(fallbacks));
    }
  }

  // دریافت لیست کامل مدل‌های در دسترس
  getAllAvailableModels() {
    return CONFIG.GEMINI_MODELS;
  }
}
