import { CONFIG } from './config.js';

export class MemoryService {
  constructor(kv) {
    this.kv = kv;
  }

  // دریافت پروفایل کاربر
  async getProfile(userId) {
    if (!this.kv) return { profile: {}, preferences: {}, lastInteraction: null };
    const raw = await this.kv.get(`memory:${userId}`);
    return raw ? JSON.parse(raw) : { profile: {}, preferences: {}, lastInteraction: null };
  }

  // به‌روزرسانی مشخصات پروفایل (نام، شهر، شغل و...)
  async updateProfile(userId, newFields) {
    if (!this.kv) return;
    const current = await this.getProfile(userId);
    current.profile = { ...current.profile, ...newFields };
    current.lastInteraction = new Date().toISOString();
    await this.kv.put(`memory:${userId}`, JSON.stringify(current), {
      expirationTtl: CONFIG.MEMORY_TTL_SECONDS
    });
  }

  // به‌روزرسانی ترجیحات
  async updatePreferences(userId, prefs) {
    if (!this.kv) return;
    const current = await this.getProfile(userId);
    current.preferences = { ...current.preferences, ...prefs };
    current.lastInteraction = new Date().toISOString();
    await this.kv.put(`memory:${userId}`, JSON.stringify(current), {
      expirationTtl: CONFIG.MEMORY_TTL_SECONDS
    });
  }

  // دریافت فکت‌ها (حداکثر ۲۰ فکت متنی)
  async getFacts(userId) {
    if (!this.kv) return [];
    const raw = await this.kv.get(`facts:${userId}`);
    return raw ? JSON.parse(raw) : [];
  }

  // افزودن یک فکت یا یادآوری
  async addFact(userId, factText) {
    if (!this.kv || !factText) return;
    const facts = await this.getFacts(userId);
    const cleanFact = factText.trim();
    if (!facts.includes(cleanFact)) {
      facts.push(cleanFact);
      const trimmed = facts.slice(-CONFIG.MAX_FACTS_LIMIT);
      await this.kv.put(`facts:${userId}`, JSON.stringify(trimmed), {
        expirationTtl: CONFIG.MEMORY_TTL_SECONDS
      });
    }
  }

  // حذف فکت با ایندکس
  async removeFact(userId, index) {
    if (!this.kv) return;
    const facts = await this.getFacts(userId);
    if (index >= 0 && index < facts.length) {
      facts.splice(index, 1);
      await this.kv.put(`facts:${userId}`, JSON.stringify(facts), {
        expirationTtl: CONFIG.MEMORY_TTL_SECONDS
      });
    }
  }

  // پاک‌سازی کامل حافظه کاربر
  async clearUserMemory(userId) {
    if (!this.kv) return;
    await this.kv.delete(`memory:${userId}`);
    await this.kv.delete(`facts:${userId}`);
  }

  // تولید کانتکست متنی برای System Prompt
  async getMemoryContext(userId) {
    const memory = await this.getProfile(userId);
    const facts = await this.getFacts(userId);

    const parts = [];
    if (Object.keys(memory.profile).length > 0) {
      const p = memory.profile;
      const details = [];
      if (p.name) details.push(`نام: ${p.name}`);
      if (p.city) details.push(`شهر/محل سکونت: ${p.city}`);
      if (p.job) details.push(`شغل/تخصص: ${p.job}`);
      if (p.age) details.push(`سن: ${p.age}`);
      for (const [k, v] of Object.entries(p)) {
        if (!['name', 'city', 'job', 'age'].includes(k)) details.push(`${k}: ${v}`);
      }
      parts.push(`مشخصات فردی کاربر: ${details.join(' | ')}`);
    }

    if (facts.length > 0) {
      parts.push("نکات و یادآوری‌های کاربر:\n" + facts.map(f => `• ${f}`).join("\n"));
    }

    return parts.join("\n\n");
  }
}
