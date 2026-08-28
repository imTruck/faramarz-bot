export class SearchService {
  async searchDuckDuckGo(query) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fa,en-US;q=0.9,en;q=0.8"
        }
      });
      if (!res.ok) return [];

      const html = await res.text();
      const results = [];

      // استخراج لینک‌ها، عناوین و خلاصه‌ها
      const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;

      const links = [...html.matchAll(linkRegex)].slice(0, 8);
      const snippets = [...html.matchAll(snippetRegex)].slice(0, 8);

      for (let i = 0; i < links.length; i++) {
        let rawHref = links[i][1];
        // باز کردن لینک‌های ریدایرکت uddg
        const matchUddg = rawHref.match(/uddg=([^&]+)/);
        if (matchUddg) {
          try {
            rawHref = decodeURIComponent(matchUddg[1]);
          } catch (e) {}
        }

        const rawTitle = links[i][2].replace(/<[^>]+>/g, "").trim();
        const rawSnippet = snippets[i] ? snippets[i][1].replace(/<[^>]+>/g, "").trim() : "";

        if (rawTitle && rawHref) {
          results.push({
            title: rawTitle,
            link: rawHref,
            snippet: rawSnippet
          });
        }
      }

      return results;
    } catch (e) {
      return [];
    }
  }
}
