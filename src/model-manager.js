import { CONFIG } from './config.js';

export class ModelManager {
  constructor(storage) {
    this.storage = storage;
  }

  // انتخاب هوشمند سریع‌ترین مدل برای پردازش سرچ و Grounding
  async getFastSearchModel() {
    if (this.storage.kv) {
      const customSearchModel = await this.storage.kv.get("config:fast_search_model");
      if (customSearchModel) return customSearchModel;
    }
    return CONFIG.FAST_SEARCH_MODEL || "gemini-2.5-flash";
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

  // دریافت تمام مدل‌ها (ترکیب مدل‌های پیش‌فرض + مدل‌های جدید کشف‌شده به صورت خودکار از گوگل در KV)
  async getAllAvailableModels() {
    const modelsMap = new Map();
    
    // مدل‌های پایه
    CONFIG.GEMINI_MODELS.forEach(m => modelsMap.set(m.id, m));

    // مدل‌های داینامیک کشف‌شده از KV
    if (this.storage.kv) {
      const raw = await this.storage.kv.get("config:discovered_models");
      if (raw) {
        try {
          const discovered = JSON.parse(raw);
          discovered.forEach(d => {
            if (!modelsMap.has(d.id)) {
              modelsMap.set(d.id, { id: d.id, name: `✨ ${d.name || d.id}` });
            }
          });
        } catch (e) {}
      }
    }

    return Array.from(modelsMap.values());
  }

  // دریافت لیست Fallback ها
  async getFallbacks() {
    if (!this.storage.kv) return ["gemini-2.0-flash", "gemini-1.5-flash"];
    const raw = await this.storage.kv.get("config:fallback_models");
    return raw ? JSON.parse(raw) : ["gemini-2.0-flash", "gemini-1.5-flash"];
  }
}
