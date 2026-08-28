export function renderAdminDashboard(data) {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>راه‌اندازی و وضعیت ربات فرامرز</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151d30;
      --primary: #38bdf8;
      --primary-hover: #0ea5e9;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: #23304c;
      --success: #22c55e;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 1.5rem;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 650px;
      width: 100%;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    h1 {
      color: var(--primary);
      margin-bottom: 0.25rem;
      font-size: 1.75rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .badge-success {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .badge-danger {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 1rem;
    }
    .stat-item {
      background: rgba(11, 15, 25, 0.5);
      padding: 1rem;
      border-radius: 10px;
      border: 1px solid var(--border);
    }
    .stat-label {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .stat-value {
      font-size: 1.1rem;
      font-weight: bold;
      margin-top: 0.35rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: #cbd5e1;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.85rem 1rem;
      background: rgba(11, 15, 25, 0.8);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: var(--primary);
    }
    button {
      width: 100%;
      padding: 0.9rem;
      background: var(--primary);
      color: #0b0f19;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    button:hover {
      background: var(--primary-hover);
    }
    button:active {
      transform: scale(0.99);
    }
    .alert {
      padding: 1rem;
      border-radius: 10px;
      margin-bottom: 1.25rem;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .alert-success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #86efac;
    }
    .alert-info {
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #bae6fd;
    }
    code {
      background: rgba(0,0,0,0.3);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #f472b6;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 کنترل پنل و راه‌اندازی فرامرز</h1>
      <p style="color: var(--muted); font-size: 0.95rem;">Cloudflare Workers • Edge Serverless</p>
    </header>

    ${data.message ? `<div class="alert alert-success">${data.message}</div>` : ''}

    <div class="card">
      <h2 style="font-size: 1.2rem; margin-top: 0;">📊 وضعیت اتصالات لبه</h2>
      <div class="grid">
        <div class="stat-item">
          <div class="stat-label">توکن تلگرام</div>
          <div class="stat-value">
            ${data.hasToken ? '<span class="badge badge-success">✅ متصل</span>' : '<span class="badge badge-danger">❌ ثبت نشده</span>'}
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">کلید Gemini API</div>
          <div class="stat-value">
            ${data.hasGemini ? '<span class="badge badge-success">✅ متصل</span>' : '<span class="badge badge-danger">❌ ثبت نشده</span>'}
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">دیتابیس KV_STORAGE</div>
          <div class="stat-value">
            ${data.kvWorking ? '<span class="badge badge-success">✅ فعال</span>' : '<span class="badge badge-danger">❌ نامتصل</span>'}
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">مدل فعال پیش‌فرض</div>
          <div class="stat-value"><code style="font-size: 0.9rem;">${data.primaryModel}</code></div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 style="font-size: 1.2rem; margin-top: 0;">⚡ راه‌اندازی و تنظیم سریع کلیدها</h2>
      <p style="color: var(--muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.25rem;">
        می‌توانید توکن و کلید را مستقیماً از فرم زیر وارد کنید. این فرم کلیدها را مستقیم در KV ذخیره کرده و <b>وبهوک تلگرام را به صورت خودکار فعال می‌کند</b>:
      </p>

      <form method="POST" action="/setup">
        <div class="form-group">
          <label for="bot_token">توکن ربات تلگرام (Bot Token):</label>
          <input type="password" id="bot_token" name="bot_token" placeholder="مثال: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" required>
        </div>

        <div class="form-group">
          <label for="gemini_key">کلید Gemini API گوگل:</label>
          <input type="password" id="gemini_key" name="gemini_key" placeholder="مثال: AIzaSy..." required>
        </div>

        <button type="submit">🚀 ذخیره کلیدها و فعال‌سازی خودکار ربات</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}
