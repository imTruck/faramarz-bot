export function renderAdminDashboard(data) {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>داشبورد فرامرز | Cloudflare Workers</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --primary: #38bdf8;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: #334155;
      --success: #22c55e;
    }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 800px;
      width: 100%;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    h1 {
      color: var(--primary);
      margin-bottom: 0.5rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: bold;
      background: rgba(34, 197, 94, 0.2);
      color: var(--success);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .stat-item {
      background: rgba(15, 23, 42, 0.6);
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .stat-label {
      color: var(--muted);
      font-size: 0.875rem;
    }
    .stat-value {
      font-size: 1.25rem;
      font-weight: bold;
      margin-top: 0.25rem;
      color: var(--primary);
    }
    code {
      background: rgba(0,0,0,0.3);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #f472b6;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 وضعیت ربات فرامرز</h1>
      <p style="color: var(--muted)">Cloudflare Workers + KV Storage Engine</p>
      <span class="badge">● آنلاین و پایدار</span>
    </header>

    <div class="card">
      <h2>📊 مشخصات اتصال لبه</h2>
      <div class="grid">
        <div class="stat-item">
          <div class="stat-label">مدل فعال پیش‌فرض</div>
          <div class="stat-value"><code>${data.primaryModel}</code></div>
        </div>
        <div class="stat-item">
          <div class="stat-label">وضعیت توکن ربات</div>
          <div class="stat-value">${data.hasToken ? '✅ متصل' : '❌ ناموجود'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">کلید Gemini API</div>
          <div class="stat-value">${data.hasGemini ? '✅ متصل' : '❌ ناموجود'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">مخزن دیتابیس KV</div>
          <div class="stat-value">${data.kvWorking ? '✅ متصل و تایید شده' : '❌ نامتصل'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>⚙️ مدیریت سریع</h2>
      <p style="color: var(--muted); line-height: 1.6;">
        برای مدیریت ربات، تغییر مدل‌ها، مشاهده لاگ‌ها یا دریافت قیمت‌ها از داخل تلگرام دستور <code>/admin</code> را ارسال کنید.
      </p>
    </div>
  </div>
</body>
</html>`;
}
