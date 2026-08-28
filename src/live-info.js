export class LiveInfoService {
  constructor() {
    this.tgjuUrl = "https://call4.tgju.org/ajax.json";
    this.cryptoUrl = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin,solana,the-open-network,binancecoin,litecoin,ripple&vs_currencies=usd&include_24hr_change=true";
  }

  // تبدیل ریال به تومان با فرمت فارسی و جداکننده هزارگان
  formatToman(rialString) {
    if (!rialString) return "نامشخص";
    const cleanNum = parseInt(String(rialString).replace(/,/g, ""), 10);
    if (isNaN(cleanNum)) return rialString;
    const toman = Math.floor(cleanNum / 10);
    return toman.toLocaleString("fa-IR") + " تومان";
  }

  // دریافت نرخ‌های بازار ایران از TGJU
  async getIranPrices() {
    try {
      const res = await fetch(this.tgjuUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json"
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      const current = data.current || {};

      return {
        dollar: this.formatToman(current.price_dollar_rl?.p),
        euro: this.formatToman(current.price_eur?.p),
        gold18: this.formatToman(current.tgju_gold_irg18?.p),
        mesghal: this.formatToman(current.mesghal?.p),
        sekee: this.formatToman(current.sekee?.p),
        melted: this.formatToman(current.gold_melted_transfer?.p),
        time: current.price_dollar_rl?.t || "امروز"
      };
    } catch (e) {
      return null;
    }
  }

  // دریافت قیمت‌های ارز دیجیتال از CoinGecko
  async getCryptoPrices() {
    try {
      const res = await fetch(this.cryptoUrl, {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // تشخیص خودکار کلیدواژه‌های قیمت و تولید گزارش فوری
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
        if (isCurrency || isGold) {
          report += `💵 **دلار آزاد:** ${tgju.dollar}\n`;
          report += `💶 **یورو:** ${tgju.euro}\n`;
          report += `🪙 **سکه امامی:** ${tgju.sekee}\n`;
          report += `✨ **طلای ۱۸ عیار:** ${tgju.gold18}\n`;
          report += `⚖️ **مثقال طلا:** ${tgju.mesghal}\n`;
          report += `🧈 **طلای آبشده:** ${tgju.melted}\n`;
          report += `⏱ *به‌روزرسانی: ${tgju.time}*\n\n`;
        }
      }
    }

    if (isCrypto) {
      const crypto = await this.getCryptoPrices();
      if (crypto) {
        report += "🌐 **ارزهای دیجیتال (قیمت دلاری و تغییرات ۲۴ ساعته):**\n";
        if (crypto.bitcoin) {
          const change = crypto.bitcoin.usd_24h_change?.toFixed(2) || 0;
          report += `₿ **Bitcoin:** $${crypto.bitcoin.usd.toLocaleString()} (${change >= 0 ? '+' : ''}${change}%)\n`;
        }
        if (crypto.ethereum) {
          const change = crypto.ethereum.usd_24h_change?.toFixed(2) || 0;
          report += `Ξ **Ethereum:** $${crypto.ethereum.usd.toLocaleString()} (${change >= 0 ? '+' : ''}${change}%)\n`;
        }
        if (crypto.solana) {
          const change = crypto.solana.usd_24h_change?.toFixed(2) || 0;
          report += `◎ **Solana:** $${crypto.solana.usd.toLocaleString()} (${change >= 0 ? '+' : ''}${change}%)\n`;
        }
        if (crypto['the-open-network']) {
          const change = crypto['the-open-network'].usd_24h_change?.toFixed(2) || 0;
          report += `💎 **TON:** $${crypto['the-open-network'].usd.toLocaleString()} (${change >= 0 ? '+' : ''}${change}%)\n`;
        }
        if (crypto.dogecoin) {
          const change = crypto.dogecoin.usd_24h_change?.toFixed(2) || 0;
          report += `🐕 **Dogecoin:** $${crypto.dogecoin.usd.toLocaleString()} (${change >= 0 ? '+' : ''}${change}%)\n`;
        }
        if (crypto.binancecoin) {
          const change = crypto.binancecoin.usd_24h_change?.toFixed(2) || 0;
          report += `🔶 **BNB:** $${crypto.binancecoin.usd.toLocaleString()} (${change >= 0 ? '+' : ''}${change}%)\n`;
        }
        if (crypto.ripple) {
          const change = crypto.ripple.usd_24h_change?.toFixed(2) || 0;
          report += `🌊 **XRP:** $${crypto.ripple.usd.toLocaleString()} (${change >= 0 ? '+' : ''}${change}%)\n`;
        }
      }
    }

    return { isHandled: true, response: report };
  }
}
