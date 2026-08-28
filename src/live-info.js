// src/live-info.js - کش هوشمند جهت پاسخ‌دهی زیر ۲۰ میلی‌ثانیه
let tgjuCache = { data: null, timestamp: 0 };
let cryptoCache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 2 * 60 * 1000; // ۲ دقیقه کش

export class LiveInfoService {
  constructor() {
    this.tgjuUrl = "https://call4.tgju.org/ajax.json";
    this.cryptoUrl = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin,solana,the-open-network,binancecoin,litecoin,ripple&vs_currencies=usd&include_24hr_change=true";
  }

  formatToman(rialString) {
    if (!rialString) return "نامشخص";
    const cleanNum = parseInt(String(rialString).replace(/,/g, ""), 10);
    if (isNaN(cleanNum)) return rialString;
    const toman = Math.floor(cleanNum / 10);
    return toman.toLocaleString("fa-IR") + " تومان";
  }

  async getIranPrices() {
    const now = Date.now();
    if (tgjuCache.data && (now - tgjuCache.timestamp < CACHE_TTL_MS)) {
      return tgjuCache.data;
    }
    try {
      const res = await fetch(this.tgjuUrl, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
      });
      if (!res.ok) return tgjuCache.data;
      const data = await res.json();
      const current = data.current || {};

      const result = {
        dollar: this.formatToman(current.price_dollar_rl?.p),
        euro: this.formatToman(current.price_eur?.p),
        gold18: this.formatToman(current.tgju_gold_irg18?.p),
        mesghal: this.formatToman(current.mesghal?.p),
        sekee: this.formatToman(current.sekee?.p),
        melted: this.formatToman(current.gold_melted_transfer?.p),
        time: current.price_dollar_rl?.t || "امروز"
      };
      tgjuCache = { data: result, timestamp: now };
      return result;
    } catch (e) {
      return tgjuCache.data;
    }
  }

  async getCryptoPrices() {
    const now = Date.now();
    if (cryptoCache.data && (now - cryptoCache.timestamp < CACHE_TTL_MS)) {
      return cryptoCache.data;
    }
    try {
      const res = await fetch(this.cryptoUrl, { headers: { "Accept": "application/json" } });
      if (!res.ok) return cryptoCache.data;
      const data = await res.json();
      cryptoCache = { data, timestamp: now };
      return data;
    } catch (e) {
      return cryptoCache.data;
    }
  }

  async checkQuickTriggers(text) {
    const lower = text.toLowerCase();
    const isCurrency = /(دلار|یورو|قیمت ارز|نرخ ارز|ارز)/.test(lower);
    const isGold = /(طلا|سکه|مثقال|آبشده|عیار)/.test(lower);
    const isCrypto = /(بیت\s?کوین|اتریوم|دوج|سولانا|تون|کریپتو|btc|eth|sol|ton|bnb|ltc|xrp)/.test(lower);

    if (!isCurrency && !isGold && !isCrypto) {
      return { isHandled: false };
    }

    let report = "📊 **قیمت‌های لحظه‌ای بازار:**\n\n";

    if (isCurrency || isGold) {
      const tgju = await this.getIranPrices();
      if (tgju) {
        report += `💵 **دلار آزاد:** ${tgju.dollar}\n`;
        report += `💶 **یورو:** ${tgju.euro}\n`;
        report += `🪙 **سکه امامی:** ${tgju.sekee}\n`;
        report += `✨ **طلای ۱۸ عیار:** ${tgju.gold18}\n`;
        report += `⚖️ **مثقال طلا:** ${tgju.mesghal}\n`;
        report += `🧈 **طلای آبشده:** ${tgju.melted}\n`;
        report += `⏱ *به‌روزرسانی: ${tgju.time}*\n\n`;
      }
    }

    if (isCrypto) {
      const crypto = await this.getCryptoPrices();
      if (crypto) {
        report += "🌐 **ارزهای دیجیتال (دلار):**\n";
        if (crypto.bitcoin) report += `₿ **Bitcoin:** $${crypto.bitcoin.usd.toLocaleString()} (${crypto.bitcoin.usd_24h_change?.toFixed(2)}%)\n`;
        if (crypto.ethereum) report += `Ξ **Ethereum:** $${crypto.ethereum.usd.toLocaleString()} (${crypto.ethereum.usd_24h_change?.toFixed(2)}%)\n`;
        if (crypto.solana) report += `◎ **Solana:** $${crypto.solana.usd.toLocaleString()} (${crypto.solana.usd_24h_change?.toFixed(2)}%)\n`;
        if (crypto['the-open-network']) report += `💎 **TON:** $${crypto['the-open-network'].usd.toLocaleString()} (${crypto['the-open-network'].usd_24h_change?.toFixed(2)}%)\n`;
        if (crypto.dogecoin) report += `🐕 **Dogecoin:** $${crypto.dogecoin.usd.toLocaleString()} (${crypto.dogecoin.usd_24h_change?.toFixed(2)}%)\n`;
      }
    }

    return { isHandled: true, response: report };
  }
}
