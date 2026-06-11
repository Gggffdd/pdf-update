const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Файл для хранения данных (Render сохраняет диск временно, но работает)
const DB_FILE = '/tmp/devices.json';
let devices = [];

// Загружаем сохраненные устройства
if (fs.existsSync(DB_FILE)) {
    try {
        devices = JSON.parse(fs.readFileSync(DB_FILE));
    } catch(e) {}
}

function saveDevices() {
    fs.writeFileSync(DB_FILE, JSON.stringify(devices, null, 2));
}

function getDeviceInfo(userAgent) {
    let model = 'Unknown';
    
    if (!userAgent) return model;
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('iphone')) model = '🍎 iPhone';
    else if (ua.includes('samsung')) model = '📱 Samsung Galaxy';
    else if (ua.includes('xiaomi')) model = '📱 Xiaomi';
    else if (ua.includes('huawei')) model = '📱 Huawei';
    else if (ua.includes('pixel')) model = '📱 Google Pixel';
    else if (ua.includes('oneplus')) model = '📱 OnePlus';
    else if (ua.includes('android')) {
        const match = userAgent.match(/Android\s+([\d.]+)/);
        const ver = match ? match[1] : '?';
        model = `🤖 Android ${ver}`;
    } else if (ua.includes('windows')) model = '💻 Windows';
    else if (ua.includes('mac')) model = '🍎 Mac';
    else if (ua.includes('iphone')) model = '🍎 iPhone';
    else model = '📱 Unknown';
    
    return model;
}

// Получить реальный IP
function getRealIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress ||
           req.socket.remoteAddress;
}

// API: регистрация просмотра
app.post('/api/visit', (req, res) => {
    const { userAgent, screen, language, timestamp, referer } = req.body;
    const ip = getRealIP(req);
    const deviceModel = getDeviceInfo(userAgent);
    
    // Проверяем, не было ли уже такого IP сегодня
    const today = new Date().toDateString();
    const existing = devices.find(d => d.ip === ip && d.date === today);
    
    if (!existing) {
        const device = {
            id: devices.length + 1,
            ip: ip,
            model: deviceModel,
            fullUserAgent: (userAgent || '').substring(0, 150),
            screen: screen || '?',
            language: language || '?',
            date: today,
            timestamp: timestamp || new Date().toISOString(),
            downloaded: false,
            downloadTime: null
        };
        
        devices.unshift(device); // новые сверху
        if (devices.length > 100) devices.pop(); // храним 100 записей
        saveDevices();
        
        console.log(`[+] ${new Date().toLocaleString()} | ${ip} | ${deviceModel}`);
    }
    
    res.json({ status: 'ok' });
});

// API: регистрация скачивания
app.post('/api/download', (req, res) => {
    const ip = getRealIP(req);
    const { timestamp } = req.body;
    
    const device = devices.find(d => d.ip === ip && !d.downloaded);
    if (device) {
        device.downloaded = true;
        device.downloadTime = timestamp || new Date().toISOString();
        saveDevices();
        console.log(`[⬇️] СКАЧАЛ | ${device.ip} | ${device.model}`);
    }
    
    res.json({ status: 'ok' });
});

// API: получить список устройств
app.get('/api/devices', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'village2026') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const downloads = devices.filter(d => d.downloaded).length;
    
    res.json({
        total: devices.length,
        downloads: downloads,
        lastUpdate: new Date().toISOString(),
        devices: devices.slice(0, 50)
    });
});

// Отдаем APK файл (если есть)
app.get('/rat.apk', (req, res) => {
    const apkPath = path.join(__dirname, 'rat.apk');
    if (fs.existsSync(apkPath)) {
        console.log(`[📱] Выдача APK клиенту`);
        res.download(apkPath, 'PDF_Reader_Update.apk');
    } else {
        res.status(404).send('APK файл не найден. Загрузите rat.apk в корень проекта.');
    }
});

// Простая админка
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Update Panel - Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0e27;
            font-family: 'Courier New', monospace;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            color: white;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: #1a1f3e;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border: 1px solid #2a2f4e;
        }
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            color: #4ade80;
        }
        .stat-label {
            color: #9ca3af;
            margin-top: 5px;
        }
        table {
            width: 100%;
            background: #1a1f3e;
            border-radius: 10px;
            overflow: hidden;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #2a2f4e;
            color: #e5e7eb;
        }
        th {
            background: #0f142e;
            color: #818cf8;
            font-weight: bold;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-success { background: #22c55e; color: black; }
        .badge-warning { background: #eab308; color: black; }
        .refresh-btn {
            background: #6366f1;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .refresh-btn:hover { background: #4f46e5; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>📱 PDF Update Panel</h1>
        <p>Отслеживание скачиваний ратника</p>
    </div>
    
    <div class="stats" id="stats"></div>
    
    <button class="refresh-btn" onclick="loadData()">🔄 Обновить</button>
    
    <table>
        <thead>
            <tr><th>ID</th><th>IP</th><th>Модель</th><th>Экран</th><th>Время</th><th>Статус</th></tr>
        </thead>
        <tbody id="tableBody"></tbody>
    </table>
</div>

<script>
    const ADMIN_KEY = 'village2026';
    
    async function loadData() {
        try {
            const res = await fetch('/api/devices', {
                headers: { 'x-admin-key': ADMIN_KEY }
            });
            const data = await res.json();
            
            document.getElementById('stats').innerHTML = \`
                <div class="stat-card"><div class="stat-number">\${data.total}</div><div class="stat-label">Всего посетителей</div></div>
                <div class="stat-card"><div class="stat-number">\${data.downloads}</div><div class="stat-label">Скачали APK</div></div>
                <div class="stat-card"><div class="stat-number">\${Math.round(data.downloads / (data.total || 1) * 100)}%</div><div class="stat-label">Конверсия</div></div>
            \`;
            
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';
            
            data.devices.forEach(device => {
                const row = tbody.insertRow();
                row.innerHTML = \`
                    <td>\${device.id}</td>
                    <td><code>\${device.ip}</code></td>
                    <td>\${device.model}</td>
                    <td>\${device.screen}</td>
                    <td>\${new Date(device.timestamp).toLocaleString()}</td>
                    <td><span class="badge \${device.downloaded ? 'badge-success' : 'badge-warning'}">\${device.downloaded ? '✅ Скачал' : '⏳ Не скачал'}</span></td>
                \`;
            });
        } catch(e) {
            console.error(e);
        }
    }
    
    loadData();
    setInterval(loadData, 10000);
</script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`📊 Админ панель: http://localhost:${PORT}/admin`);
    console.log(`🌐 Сайт: http://localhost:${PORT}`);
});