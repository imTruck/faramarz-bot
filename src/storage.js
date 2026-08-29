import { CONFIG } from './config.js';

export class StorageService {
  constructor(env) {
    this.env = env || {};
    this.kv = this.env.KV_STORAGE || null;

    if (!globalThis.__MEMORY_STORE__) {
      globalThis.__MEMORY_STORE__ = new Map();
    }
    this.memory = globalThis.__MEMORY_STORE__;
  }

  // گرفتن کلید KV با لایه فال‌بک امن
  async get(key) {
    try {
      if (this.kv) {
        const val = await this.kv.get(key);
        if (val !== null && val !== undefined) return val;
      }
    } catch (e) {}
    return this.memory.get(key) || null;
  }

  // ذخیره کلید در KV و حافظه
  async put(key, value, options = {}) {
    this.memory.set(key, value);
    try {
      if (this.kv) {
        await this.kv.put(key, value, options);
      }
    } catch (e) {}
  }

  // حذف کلید
  async delete(key) {
    this.memory.delete(key);
    try {
      if (this.kv) {
        await this.kv.delete(key);
      }
    } catch (e) {}
  }

  // توکن بات تلگرام
  async getBotToken() {
    if (this.env.BOT_TOKEN) return this.env.BOT_TOKEN.trim();
    return await this.get("bot:token");
  }

  async setBotToken(token) {
    const clean = token.replace(/^bot/i, "").trim();
    await this.put("bot:token", clean);
    return clean.slice(0, 6) + "..." + clean.slice(-4);
  }

  // کلید Gemini API
  async getGeminiKey() {
    if (this.env.GEMINI_API_KEY) return this.env.GEMINI_API_KEY.trim();
    return await this.get("gemini:key");
  }

  async setGeminiKey(key) {
    const clean = key.trim();
    await this.put("gemini:key", clean);
    return clean.slice(0, 6) + "..." + clean.slice(-4);
  }

  // مدل پیش‌فرض چت
  async getPrimaryModel() {
    if (this.env.DEFAULT_GEMINI_MODEL) return this.env.DEFAULT_GEMINI_MODEL.trim();
    const stored = await this.get("gemini:primary_model");
    return stored || CONFIG.DEFAULT_FALLBACK_CHAIN[0];
  }

  async setPrimaryModel(modelId) {
    await this.put("gemini:primary_model", modelId);
    return modelId;
  }

  // تاریخچه چت
  async getHistory(chatId) {
    const data = await this.get(`chat:${chatId}:history`);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveHistory(chatId, history) {
    const trimmed = history.slice(-CONFIG.MAX_HISTORY_LENGTH);
    await this.put(`chat:${chatId}:history`, JSON.stringify(trimmed), {
      expirationTtl: CONFIG.HISTORY_TTL_SECONDS
    });
  }

  async clearHistory(chatId) {
    await this.delete(`chat:${chatId}:history`);
  }

  // وضعیت کاربر (State)
  async getState(userId) {
    return await this.get(`user:${userId}:state`);
  }

  async setState(userId, state) {
    await this.put(`user:${userId}:state`, state, {
      expirationTtl: CONFIG.STATE_TTL_SECONDS
    });
  }

  async clearState(userId) {
    await this.delete(`user:${userId}:state`);
  }

  // هویت کاربر
  async saveUserIdentity(user) {
    if (!user || !user.id) return;
    const key = `user:${user.id}:identity`;
    const payload = JSON.stringify({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name || "",
      username: user.username || "",
      last_seen: new Date().toISOString()
    });
    await this.put(key, payload);
  }

  // سیستم لاگ ورکر
  async addLog(message) {
    const logs = await this.getLogs();
    logs.push({
      timestamp: new Date().toISOString(),
      message
    });
    const trimmed = logs.slice(-50);
    await this.put("system:logs", JSON.stringify(trimmed));
  }

  async getLogs() {
    const data = await this.get("system:logs");
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}
