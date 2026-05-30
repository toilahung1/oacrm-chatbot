const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
const cron = require('node-cron');
const { google } = require('googleapis');
require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// 🛠️ DYNAMIC HTML SERVING (Inject Railway Env Vars for SEO)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function serveDynamicHtml(filename) {
    return (req, res) => {
        const filePath = path.join(__dirname, filename);
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return res.status(404).send('Not Found');
            const appId = process.env.FB_APP_ID || '';
            const processed = data.replace(/{{FB_APP_ID}}/g, appId);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(processed);
        });
    };
}

app.get('/', serveDynamicHtml('index.html'));
app.get('/index.html', serveDynamicHtml('index.html'));
app.get('/ads', serveDynamicHtml('ads.html'));
app.get('/ads.html', serveDynamicHtml('ads.html'));

app.use(express.static('./', { extensions: ['html'] }));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Database Migration: Thêm cột account_ids nếu chưa có
pool.query(`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS account_ids JSONB`).catch(err => console.error("Migration error:", err.message));

// 🛠️ SESSION PERSISTENCE (Store sessions in DB)
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'gztech_secret_2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

const PORT = process.env.PORT || 3000;

// 🛠️ GOOGLE SHEETS AUTOMATION ENGINE

async function updateGoogleSheet(spreadsheetId, allData, user) {
    if (!spreadsheetId || !user) return;
    try {
        const userRes = await pool.query('SELECT google_refresh_token FROM users WHERE id = $1', [user.id]);
        const refreshToken = userRes.rows[0]?.google_refresh_token;
        if (!refreshToken) return;

        const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'postmessage');
        auth.setCredentials({ refresh_token: refreshToken });

        const sheets = google.sheets({ version: 'v4', auth });
        const timeNow = new Date().toLocaleTimeString('vi-VN', { hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
        const dateNow = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        for (const acc of allData) {
            if (!acc.tree) continue;

            const campRows = [];
            const setRows = [];
            const adRows = [];

            for (const [cName, cData] of Object.entries(acc.tree)) {
                const cSpend = parseFloat(cData.spend) || 0;
                const cMsg = parseInt(cData.msg || cData.msgs || 0);
                const cReplies = parseInt(cData.replies || 0);
                const cLink = parseInt(cData.link_clicks || 0);
                const cImp = parseInt(cData.impressions || 0);
                const cReach = parseInt(cData.reach || 0);
                const cOutbound = parseInt(cData.outbound_clicks || 0);

                const timeStamp = `${dateNow} ${timeNow}`;

                campRows.push([
                    timeStamp, 
                    acc.name || acc.id,
                    cName,
                    cData.status || 'Hoạt động',
                    cImp,
                    cMsg,
                    cMsg > 0 ? Math.round(cSpend / cMsg).toLocaleString('vi-VN') + ' ₫' : '0 ₫',
                    cReplies,
                    cLink,
                    (cImp > 0 ? (cLink / cImp * 100) : 0).toFixed(2) + '%',
                    cOutbound,
                    cLink > 0 ? Math.round(cSpend / cLink).toLocaleString('vi-VN') + ' ₫' : '0 ₫',
                    cData.v30 || 0,
                    cData.vp25 || 0,
                    cData.vp100 || 0,
                    (parseFloat(cData.budget) || 0).toLocaleString('vi-VN') + ' ₫',
                    cSpend.toLocaleString('vi-VN') + ' ₫',
                    cImp,
                    cReach,
                    cData.stop_time || '—',
                    cData.objective || '—',
                    (cReach > 0 ? (cImp / cReach) : 1).toFixed(2),
                    Math.round(cImp > 0 ? (cSpend / cImp * 1000) : 0).toLocaleString('vi-VN') + ' ₫',
                    Math.round(cLink > 0 ? (cSpend / cLink) : 0).toLocaleString('vi-VN') + ' ₫',
                    (cImp > 0 ? (cLink / cImp * 100) : 0).toFixed(2) + '%',
                    parseFloat(cData.roas || 0).toFixed(2) + 'x'
                ]);

                for (const [sName, sData] of Object.entries(cData.sets)) {
                    const sSpend = parseFloat(sData.spend) || 0;
                    const sMsg = parseInt(sData.results || 0);
                    const sLink = parseInt(sData.link_clicks || 0);
                    const sImp = parseInt(sData.impressions || 0);
                    const sReach = parseInt(sData.reach || 0);

                    setRows.push([
                        timeStamp, 
                        acc.name || acc.id,
                        cName,
                        sName,
                        sData.status || 'Hoạt động',
                        sImp,
                        sMsg,
                        sMsg > 0 ? Math.round(sSpend / sMsg).toLocaleString('vi-VN') + ' ₫' : '0 ₫',
                        sData.replies || 0,
                        sLink,
                        (sImp > 0 ? (sLink / sImp * 100) : 0).toFixed(2) + '%',
                        sData.outbound_clicks || 0,
                        sLink > 0 ? Math.round(sSpend / sLink).toLocaleString('vi-VN') + ' ₫' : '0 ₫',
                        sData.v30 || 0,
                        sData.vp25 || 0,
                        sData.vp100 || 0,
                        (parseFloat(sData.budget) || 0).toLocaleString('vi-VN') + ' ₫',
                        sSpend.toLocaleString('vi-VN') + ' ₫',
                        sImp,
                        sReach,
                        sData.stop_time || '—',
                        cData.objective || '—',
                        (sReach > 0 ? (sImp / sReach) : 1).toFixed(2),
                        Math.round(sImp > 0 ? (sSpend / sImp * 1000) : 0).toLocaleString('vi-VN') + ' ₫',
                        Math.round(sLink > 0 ? (sSpend / sLink) : 0).toLocaleString('vi-VN') + ' ₫',
                        (sImp > 0 ? (sLink / sImp * 100) : 0).toFixed(2) + '%',
                        parseFloat(sData.roas || 0).toFixed(2) + 'x'
                    ]);

                    for (const adItem of sData.ads) {
                        const adSpend = parseFloat(adItem.spend) || 0;
                        const adMsg = parseInt(adItem.msgs || 0);
                        const adLink = parseInt(adItem.link_clicks || 0);
                        const adImp = parseInt(adItem.impressions || 0);
                        const adReach = parseInt(adItem.reach || 0);

                        adRows.push([
                            timeStamp, 
                            acc.name || acc.id,
                            cName,
                            sName,
                            adItem.name,
                            adItem.status || 'Hoạt động',
                            adImp,
                            adMsg,
                            adMsg > 0 ? Math.round(adSpend / adMsg).toLocaleString('vi-VN') + ' ₫' : '0 ₫',
                            adItem.replies || 0,
                            adLink,
                            (adImp > 0 ? (adLink / adImp * 100) : 0).toFixed(2) + '%',
                            adItem.outbound_clicks || 0,
                            adLink > 0 ? Math.round(adSpend / adLink).toLocaleString('vi-VN') + ' ₫' : '0 ₫',
                            adItem.v30 || 0,
                            adItem.vp25 || 0,
                            adItem.vp100 || 0,
                            (parseFloat(sData.budget) || 0).toLocaleString('vi-VN') + ' ₫',
                            adSpend.toLocaleString('vi-VN') + ' ₫',
                            adImp,
                            adReach,
                            sData.stop_time || '—',
                            cData.objective || '—',
                            (adReach > 0 ? (adImp / adReach) : 1).toFixed(2),
                            Math.round(adImp > 0 ? (adSpend / adImp * 1000) : 0).toLocaleString('vi-VN') + ' ₫',
                            Math.round(adLink > 0 ? (adSpend / adLink) : 0).toLocaleString('vi-VN') + ' ₫',
                            (adImp > 0 ? (adLink / adImp * 100) : 0).toFixed(2) + '%',
                            parseFloat(adItem.roas || 0).toFixed(2) + 'x'
                        ]);
                    }
                }
            }

            // Thực hiện Append vào các tab tương ứng
            if (campRows.length) {
                await sheets.spreadsheets.values.append({
                    spreadsheetId, range: "'1. Chiến dịch'!A2", valueInputOption: 'RAW', resource: { values: campRows }
                });
            }
            if (setRows.length) {
                await sheets.spreadsheets.values.append({
                    spreadsheetId, range: "'2. Nhóm quảng cáo'!A2", valueInputOption: 'RAW', resource: { values: setRows }
                });
            }
            if (adRows.length) {
                await sheets.spreadsheets.values.append({
                    spreadsheetId, range: "'3. Quảng cáo'!A2", valueInputOption: 'RAW', resource: { values: adRows }
                });
            }
            
            // Rate limiting: Delay 1s between accounts to avoid Google Sheets Quota Exceeded
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (err) {
        console.error('❌ Google Sheets Append Error:', err.message);
    }
}

async function generateMonthlySummary(user) {
    // Logic cho cuối tháng sẽ được thực hiện sau
}


// --- API: SYNC SESSION ---
app.post('/api/auth/sync-session', async (req, res) => {
    try {
        const { access_token } = req.body;
        if (!access_token) return res.status(401).json({ error: 'No token' });

        // Kiểm tra xem user có tồn tại với token này không
        const dbRes = await pool.query('SELECT id, fb_name as username FROM user_notifications WHERE fb_access_token = $1', [access_token]);
        if (dbRes.rows.length > 0) {
            req.session.user = dbRes.rows[0];
            return res.json({ success: true });
        }

        // Nếu không tìm thấy nhưng session đang có sẵn user thì vẫn OK
        if (req.session && req.session.user) return res.json({ success: true });

        res.status(401).json({ success: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage'
);

// API: Google Auth Callback
app.post('/api/auth/google/callback', async (req, res) => {
    try {
        const { code } = req.body;
        const { tokens } = await oauth2Client.getToken(code);

        if (tokens.refresh_token) {
            const userId = req.session?.user?.id || 1;
            await pool.query('UPDATE users SET google_refresh_token = $1 WHERE id = $2', [tokens.refresh_token, userId]);
            // Kích hoạt chạy ngay lần đầu
            fetchAndSendAllReports().catch(console.error);
        }

        res.json({ success: true, tokens });
    } catch (err) {
        console.error('Google Token Exchange Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Cập nhật hàm getDailySheet để dùng OAuth2
async function getDailySheet(user, accName) {
    try {
        // Lấy Refresh Token từ DB
        const userRes = await pool.query('SELECT google_refresh_token FROM users WHERE id = $1', [user.id]);
        const refreshToken = userRes.rows[0]?.google_refresh_token;
        if (!refreshToken) return null;

        const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'postmessage');
        auth.setCredentials({ refresh_token: refreshToken });

        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        const fileName = `${dateStr} - ${accName}`;

        const check = await pool.query('SELECT spreadsheet_id FROM daily_reports WHERE user_id = $1 AND account_name = $2 AND report_date = CURRENT_DATE', [user.id, accName]);
        
        const sheets = google.sheets({ version: 'v4', auth });
        let spreadsheetId;
        let sheetIds = [];

        if (check.rows.length > 0) {
            spreadsheetId = check.rows[0].spreadsheet_id;
            const ss = await sheets.spreadsheets.get({ spreadsheetId });
            sheetIds = ss.data.sheets.map(s => s.properties.sheetId);
        } else {
            const resource = { properties: { title: fileName } };
            const spreadsheet = await sheets.spreadsheets.create({ resource, fields: 'spreadsheetId,sheets' });
            spreadsheetId = spreadsheet.data.spreadsheetId;
            const mainSheetId = spreadsheet.data.sheets[0].properties.sheetId;

            await pool.query('INSERT INTO daily_reports (user_id, account_name, report_date, spreadsheet_id) VALUES ($1, $2, CURRENT_DATE, $3)', [user.id, accName, spreadsheetId]);

            // Tab Requests
            const tabReqs = [
                { updateSheetProperties: { properties: { sheetId: mainSheetId, title: '1. Chiến dịch' }, fields: 'title' } },
                { addSheet: { properties: { title: '2. Nhóm quảng cáo' } } },
                { addSheet: { properties: { title: '3. Quảng cáo' } } }
            ];

            const batchRes = await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests: tabReqs } });
            sheetIds = [mainSheetId, batchRes.data.replies[1].addSheet.properties.sheetId, batchRes.data.replies[2].addSheet.properties.sheetId];
        }

        // Headers & Formatting
        const headers = {
            '1. Chiến dịch': ["Thời gian", "Tài khoản", "Chiến dịch", "Trạng thái", "Hiển thị", "Kết quả", "Chi phí / H.thoại", "Phản hồi tin nhắn", "Lượt nhấp (Link)", "CTR Liên kết", "Nhấp ra ngoài", "Chi phí / Lượt nhấp", "Video 30s", "Video 25%", "Video 100%", "Ngân sách", "Số tiền đã chi tiêu", "Hiển thị", "Tiếp cận", "Kết thúc", "Mục tiêu", "Tần suất", "CPM", "CPC", "CTR", "ROAS"],
            '2. Nhóm quảng cáo': ["Thời gian", "Tài khoản", "Chiến dịch", "Nhóm quảng cáo", "Trạng thái", "Hiển thị", "Kết quả", "Chi phí/Kết quả", "Phản hồi tin nhắn", "Lượt nhấp (Link)", "CTR Liên kết", "Nhấp ra ngoài", "Chi phí/Lượt nhấp", "Video 30s", "Video 25%", "Video 100%", "Ngân sách", "Số tiền đã chi", "Hiển thị", "Tiếp cận", "Kết thúc", "Mục tiêu", "Tần suất", "CPM", "CPC", "CTR", "ROAS"],
            '3. Quảng cáo': ["Thời gian", "Tài khoản", "Chiến dịch", "Nhóm quảng cáo", "Quảng cáo", "Trạng thái", "Hiển thị", "Kết quả", "Chi phí/Kết quả", "Phản hồi tin nhắn", "Lượt nhấp (Link)", "CTR Liên kết", "Nhấp ra ngoài", "Chi phí/Lượt nhấp", "Video 30s", "Video 25%", "Video 100%", "Ngân sách", "Số tiền đã chi", "Hiển thị", "Tiếp cận", "Kết thúc", "Mục tiêu", "Tần suất", "CPM", "CPC", "CTR", "ROAS"]
        };

        const formatReqs = [];
        let idx = 0;
        for (const [title, values] of Object.entries(headers)) {
            await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${title}'!A1`, valueInputOption: 'RAW', resource: { values: [values] } });
            const sId = sheetIds[idx];
            formatReqs.push(
                { repeatCell: { range: { sheetId: sId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.1, green: 0.4, blue: 1.0 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 }, horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)' } },
                { updateSheetProperties: { properties: { sheetId: sId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } }
            );
            idx++;
        }
        await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests: formatReqs } });

        return spreadsheetId;
    } catch (err) {
        console.error('❌ Google Sheets OAuth Error:', err.message);
        return null;
    }
}

// --- REAL-TIME MESSAGING (SSE) ---
let clients = [];
app.get('/api/facebook/sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
    });

    // Heart-beat (Ping) mỗi 30s để giữ kết nối không bị ngắt bởi Proxy/Browser
    const keepAlive = setInterval(() => {
        res.write(':keepalive\n\n');
    }, 30000);

    req.on('close', () => clearInterval(keepAlive));
});

function broadcastMessage(data) {
    const deadClients = [];
    console.log(`📡 Broadcasting ${data.type} to ${clients.length} clients...`);
    clients.forEach(client => {
        try {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
            console.error('SSE Write Error:', err.message);
            deadClients.push(client.id);
        }
    });
    if (deadClients.length > 0) {
        clients = clients.filter(c => !deadClients.includes(c.id));
        console.log(`🧹 Cleaned up ${deadClients.length} dead SSE clients.`);
    }
}

// --- AI CHATBOT ---
app.post('/api/ai/toggle', async (req, res) => {
    const { pageId, enabled } = req.body;
    try {
        await pool.query('UPDATE facebook_pages SET ai_enabled = $1 WHERE page_id = $2', [enabled, pageId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/ai/assets', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, "fileName", "assetType", "aiDescription" FROM brand_assets ORDER BY id DESC');
        res.json({ assets: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai/assets', async (req, res) => {
    const { type, name, desc, pageIds } = req.body;
    try {
        await pool.query('INSERT INTO brand_assets ("assetType", "fileName", "aiDescription", page_ids) VALUES ($1, $2, $3, $4)', [type, name, desc, JSON.stringify(pageIds || [])]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/ai/assets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM brand_assets WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/db-check', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT NOW()');
        res.json({ success: true, time: dbRes.rows[0].now, status: 'Connected' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/ai/status', async (req, res) => {
    try {
        const { pageId } = req.query;
        if (pageId) {
            const pageRes = await pool.query('SELECT ai_enabled FROM facebook_pages WHERE page_id = $1', [pageId]);
            if (pageRes.rows.length > 0) {
                return res.json({ enabled: !!pageRes.rows[0].ai_enabled });
            }
        }
        // Fallback: Kiểm tra bảng cấu hình chung
        const dbRes = await pool.query('SELECT ai_enabled FROM user_notifications LIMIT 1');
        res.json({ enabled: !!dbRes.rows[0]?.ai_enabled });
    } catch (err) { 
        console.error('❌ AI Status API Error:', err.message);
        res.json({ enabled: false }); 
    }
});

app.post('/api/facebook/sync-pages', async (req, res) => {
    try {
        const { pages } = req.body;
        if (!pages || !Array.isArray(pages)) return res.status(400).json({ error: 'Invalid pages data' });

        const userId = req.session?.user?.id || null;
        for (const page of pages) {
            if (!page.id || !page.access_token) continue;
            await pool.query(`
                INSERT INTO facebook_pages (page_id, page_name, page_access_token, page_token, user_id)
                VALUES ($1, $2, $3, $3, $4::INTEGER)
                ON CONFLICT ON CONSTRAINT fb_page_id_unique DO UPDATE SET page_name = $2, page_access_token = $3, page_token = $3, user_id = $4::INTEGER
            `, [page.id, page.name, page.access_token, userId]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Sync Pages Endpoint Error:', err.message);
        res.status(500).json({ error: 'Database sync failed', details: err.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        let brandContext = "";
        try {
            const dbRes = await pool.query('SELECT "fileName", "assetType", "aiDescription", "extractedText", "extractedColors" FROM brand_assets LIMIT 5');
            if (dbRes.rows.length > 0) {
                brandContext = " Dữ liệu thương hiệu: " + dbRes.rows.map(row => `[${row.assetType}: ${row.fileName}] Mô tả: ${row.aiDescription || 'N/A'}`).join(" | ");
            }
        } catch (dbErr) { console.error('DB Context Error:', dbErr.message); }

        const systemPrompt = `Bạn là GENZ Assistant, trợ lý AI thông minh của hệ sinh thái GENZTECH MARKETING. 
        NHIỆM VỤ CỦA BẠN:
        1. SUY NGHĨ LOGIC: Trước khi trả lời, hãy phân tích kỹ yêu cầu của người dùng, bối cảnh thương hiệu và các dữ liệu đi kèm.
        2. PHONG CÁCH: Chuyên nghiệp, hiện đại, tinh tế và cực kỳ thân thiện.
        3. DỮ LIỆU THƯƠNG HIỆU: Sử dụng thông tin này để cá nhân hóa câu trả lời: ${brandContext}
        4. CHIẾN THUẬT: Nếu khách hỏi về giá hoặc dịch vụ, hãy khéo léo lồng ghép lợi ích và giá trị cốt lõi của GENZTECH.
        HÃY SUY NGHĨ TỪNG BƯỚC MỘT ĐỂ ĐƯA RA CÂU TRẢ LỜI TỐT NHẤT.`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
            temperature: 0.7
        }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

        res.json({ reply: response.data.choices[0].message.content });
    } catch (error) {
        console.error('OpenAI Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'AI Error' });
    }
});

// --- DATABASE INIT ---
async function initDb() {
    try {
        const queries = [
            `CREATE TABLE IF NOT EXISTS user_notifications (id SERIAL PRIMARY KEY, telegram_id TEXT UNIQUE, fb_access_token TEXT, fb_name TEXT, last_report TEXT, ads_data JSONB, is_active BOOLEAN DEFAULT TRUE, ai_enabled BOOLEAN DEFAULT FALSE, last_sent TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`,
            `ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS ads_data JSONB`,
            `ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS last_report TEXT`,
            `CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL, page_ids JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`,
            `CREATE TABLE IF NOT EXISTS product_orders (id SERIAL PRIMARY KEY, store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE, product_name TEXT NOT NULL, inventory INTEGER DEFAULT 0, image_url TEXT, price NUMERIC DEFAULT 0, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`,
            `ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE`,
            `CREATE TABLE IF NOT EXISTS sales_history (id SERIAL PRIMARY KEY, store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE, product_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL, customer_name TEXT, quantity INTEGER DEFAULT 1, total_price NUMERIC, created_at TIMESTAMP DEFAULT NOW())`,
            `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'staff', owner_email TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_email TEXT`,
            `ALTER TABLE stores ADD COLUMN IF NOT EXISTS owner_email TEXT`,
            `ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS owner_email TEXT`,
            `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_owner_key') THEN ALTER TABLE users ADD CONSTRAINT users_username_owner_key UNIQUE(username, owner_email); END IF; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Constraint already exists'; END $$;`,
            `CREATE TABLE IF NOT EXISTS resource_access (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, resource_id TEXT NOT NULL, resource_name TEXT, resource_type TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, resource_id))`,
            `CREATE TABLE IF NOT EXISTS crm_todos (id SERIAL PRIMARY KEY, google_email TEXT NOT NULL, todo_text TEXT NOT NULL, is_done BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS facebook_pages (page_id TEXT PRIMARY KEY, page_name TEXT, page_access_token TEXT, ai_enabled BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW())`,
            `DELETE FROM facebook_pages a USING facebook_pages b WHERE a.ctid < b.ctid AND a.page_id = b.page_id`,
            `ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS page_access_token TEXT`,
            `ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS page_token TEXT`,
            `ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS user_id INTEGER`,
            `ALTER TABLE facebook_pages ADD COLUMN IF NOT EXISTS fb_token_id INTEGER`,
            `ALTER TABLE facebook_pages ALTER COLUMN user_id DROP NOT NULL`,
            `ALTER TABLE facebook_pages ALTER COLUMN fb_token_id DROP NOT NULL`,
            `ALTER TABLE facebook_pages ALTER COLUMN page_token DROP NOT NULL`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fb_page_id_unique') THEN ALTER TABLE facebook_pages ADD CONSTRAINT fb_page_id_unique UNIQUE (page_id); END IF; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Constraint already exists'; END $$;`,
            `CREATE TABLE IF NOT EXISTS brand_assets (id SERIAL PRIMARY KEY, "fileName" TEXT, "assetType" TEXT, "aiDescription" TEXT, page_ids JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW())`,
            `ALTER TABLE brand_assets ADD COLUMN IF NOT EXISTS page_ids JSONB DEFAULT '[]'`
        ];

        for (const q of queries) {
            try {
                await pool.query(q);
            } catch (err) {
                console.warn(`⚠️ DB Query Error [${q.substring(0, 30)}...]:`, err.message);
            }
        }
        console.log('✅ Database Initialization Complete');
    } catch (err) { 
        console.error('❌ Critical DB Init Error:', err.message); 
    }
}
initDb();

// --- AUTH: SWAP SHORT-LIVED TOKEN FOR LONG-LIVED (60 DAYS) ---
// Initialize DB Tables
async function initReportingDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_reports (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                account_name TEXT,
                report_date DATE DEFAULT CURRENT_DATE,
                spreadsheet_id TEXT
            );
        `);
        console.log('📡 Reporting DB Initialized');
    } catch (err) {
        console.error('❌ Reporting DB Init Error:', err.message);
    }
}
initReportingDb();

app.post('/api/auth/exchange-token', async (req, res) => {
    try {
        const { short_lived_token } = req.body;
        if (!short_lived_token) return res.status(400).json({ error: 'Token is required' });

        const appId = process.env.FB_APP_ID || process.env.FB_CLIENT_ID;
        const appSecret = process.env.FB_APP_SECRET || process.env.FB_CLIENT_SECRET;

        if (!appSecret) {
            console.error('❌ Missing FB_APP_SECRET or FB_CLIENT_SECRET');
            return res.status(500).json({ error: 'Server configuration error: missing FB secret' });
        }

        let longLivedToken;
        try {
            const fbRes = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: appId,
                    client_secret: appSecret,
                    fb_exchange_token: short_lived_token
                },
                timeout: 15000
            });
            longLivedToken = fbRes.data.access_token;
        } catch (fbErr) {
            console.error('❌ FB Token Exchange Error:', fbErr.response?.data || fbErr.message);
            return res.status(500).json({ error: 'Failed to exchange token with Facebook', details: fbErr.response?.data?.error?.message || fbErr.message });
        }

        // Lấy thông tin user từ FB
        let fbName = 'Chủ sở hữu';
        try {
            const meRes = await axios.get(`https://graph.facebook.com/me?access_token=${longLivedToken}`);
            fbName = meRes.data.name;
        } catch (meErr) { console.warn('⚠️ Could not fetch FB name'); }

        // Lưu vào DB và set Session
        try {
            const dbRes = await pool.query(
                `INSERT INTO user_notifications (fb_access_token, fb_name, telegram_id) 
                 VALUES ($1, $2, $2) 
                 ON CONFLICT (telegram_id) DO UPDATE SET fb_access_token = $1, fb_name = $2
                 RETURNING id`,
                [longLivedToken, fbName]
            );

            // Bổ sung: Cập nhật thêm cho các bản ghi đã có telegram_id xịn nhưng trùng fb_name
            await pool.query(
                `UPDATE user_notifications SET fb_access_token = $1 WHERE fb_name = $2`,
                [longLivedToken, fbName]
            );

            req.session.user = { id: dbRes.rows[0].id, username: fbName };
        } catch (dbErr) { console.error('❌ DB Update Error:', dbErr.message); }

        res.json({ success: true, access_token: longLivedToken });
    } catch (err) {
        console.error('❌ Global Token Exchange Error:', err.message);
        res.status(500).json({ error: 'Internal server error during exchange', details: err.message });
    }
});

// --- TELEGRAM WEBHOOK & COMMANDS ---
const pendingLinks = new Map();

app.get('/api/telegram/check-link', (req, res) => {
    const { code } = req.query;
    if (pendingLinks.has(code)) res.json({ success: true, chat_id: pendingLinks.get(code) });
    else res.json({ success: false });
});

app.post('/api/telegram/link-token', async (req, res) => {
    const { chat_id, fb_access_token, fb_name, account_ids } = req.body;
    try {
        // 1. Exchange for Long-lived Token (60 days)
        let longLivedToken = fb_access_token;
        const appId = process.env.FB_APP_ID || process.env.FB_CLIENT_ID;
        const appSecret = process.env.FB_APP_SECRET || process.env.FB_CLIENT_SECRET;

        if (appSecret && appId) {
            try {
                const exchangeRes = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
                    params: {
                        grant_type: 'fb_exchange_token',
                        client_id: appId,
                        client_secret: appSecret,
                        fb_exchange_token: fb_access_token
                    }
                });
                if (exchangeRes.data.access_token) {
                    longLivedToken = exchangeRes.data.access_token;
                    console.log(`✨ Exchanged for Long-lived token for ${fb_name}`);
                }
            } catch (exErr) {
                console.warn('⚠️ Token exchange failed, using short-lived instead:', exErr.message);
            }
        }

        await pool.query(`
            INSERT INTO user_notifications (telegram_id, fb_access_token, fb_name, account_ids)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (telegram_id) DO UPDATE SET fb_access_token = $2, fb_name = $3, account_ids = $4
        `, [chat_id.toString(), longLivedToken, fb_name, JSON.stringify(account_ids || [])]);

        console.log(`✅ Linked: ${fb_name} -> ${chat_id} (Long-lived: ${longLivedToken !== fb_access_token})`);
        
        // Kích hoạt đồng bộ ngay lập tức cho user này
        fetchAndSendAllReports(); 
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/telegram/webhook', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.text) return res.sendStatus(200);
        const chatId = message.chat.id;
        const text = message.text;
        console.log(`📩 Telegram: "${text}" from ${chatId}`);

        if (text === '/adsnow') {
            const data = await pool.query('SELECT last_report FROM user_notifications WHERE telegram_id = $1', [chatId.toString()]);
            if (data.rows.length > 0 && data.rows[0].last_report) {
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId, text: data.rows[0].last_report, parse_mode: 'HTML'
                });
            } else {
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId, text: "⚠️ Hiện chưa có dữ liệu. Hệ thống sẽ tự động đồng bộ trong vài phút."
                });
            }
        } else if (text.startsWith('/start')) {
            const code = text.split(' ')[1];
            if (code && code.startsWith('link_')) {
                pendingLinks.set(code, chatId);
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId, text: "✅ Liên kết thành công!\n\nChào mừng bạn tới với chatbot tự động thông báo chi tiêu ads của Genztech Corp.\n\nĐể lấy dữ liệu bất cứ lúc nào, nhập lệnh /adsnow"
                });
            } else {
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId, text: "Chào mừng bạn tới với chatbot tự động thông báo chi tiêu ads của Genztech Corp.\n\nĐể lấy dữ liệu bất cứ lúc nào, nhập lệnh /adsnow"
                });
            }
        }
        res.sendStatus(200);
    } catch (err) {
        console.error('Webhook Error:', err.message);
        res.sendStatus(200);
    }
});

// --- FACEBOOK MESSENGER WEBHOOK ---
app.get('/api/facebook/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === 'genztech_secret_token') {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post('/api/facebook/webhook', (req, res) => {
    const body = req.body;
    if (body.object === 'page') {
        body.entry.forEach(entry => {
            const messaging = entry.messaging || entry.standby;
            if (!messaging) return;
            messaging.forEach(webhookEvent => {
                const senderId = webhookEvent.sender.id;
                const recipientId = webhookEvent.recipient.id;
                if (webhookEvent.message) {
                    const messageText = webhookEvent.message.text;
                    const isEcho = webhookEvent.message.is_echo;
                    
                    broadcastMessage({
                        type: 'new_facebook_message',
                        pageId: isEcho ? senderId : recipientId,
                        senderId: isEcho ? recipientId : senderId,
                        message: webhookEvent.message,
                        isEcho: isEcho
                    });

                    if (!isEcho && !entry.standby && messageText) {
                        (async () => {
                            try {
                                const pageRes = await pool.query('SELECT page_access_token, ai_enabled FROM facebook_pages WHERE page_id = $1', [recipientId]);
                                let page = pageRes.rows[0];
                                if (!page) {
                                    const userRes = await pool.query('SELECT fb_access_token as page_access_token, ai_enabled FROM user_notifications WHERE fb_access_token IS NOT NULL LIMIT 1');
                                    page = userRes.rows[0];
                                }

                                if (page && page.ai_enabled) {
                                    // BƯỚC 0: HANDOFF CHECK
                                    const handoffRes = await pool.query('SELECT keywords, chat_id FROM chatbot_handoff_config WHERE page_id = $1', [recipientId]);
                                    const handoffConfig = handoffRes.rows[0];
                                    if (handoffConfig && handoffConfig.keywords) {
                                        const hKeywords = handoffConfig.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                                        const msgLower = messageText.toLowerCase();
                                        const shouldHandoff = hKeywords.some(k => msgLower.includes(k));
                                        
                                        if (shouldHandoff) {
                                            console.log(`[HANDOFF] Bỏ qua AI do chứa từ khoá chuyển nhân viên: ${messageText}`);
                                            const chatId = handoffConfig.chat_id || '8585365345';
                                            const teleToken = process.env.TELEGRAM_BOT_TOKEN2 || process.env.TELEGRAM_BOT_TOKEN;
                                            if (teleToken && chatId) {
                                                let customerName = 'Khách hàng';
                                                let pageName = recipientId;
                                                try {
                                                    const uRes = await axios.get(`https://graph.facebook.com/v19.0/${senderId}?fields=first_name,last_name&access_token=${page.page_access_token}`);
                                                    if (uRes.data && uRes.data.first_name) customerName = uRes.data.first_name + ' ' + (uRes.data.last_name || '');
                                                    const pRes = await axios.get(`https://graph.facebook.com/v19.0/${recipientId}?fields=name&access_token=${page.page_access_token}`);
                                                    if (pRes.data && pRes.data.name) pageName = pRes.data.name;
                                                } catch(e) {}
                                                
                                                const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                                                const pageLink = `https://business.facebook.com/latest/inbox/all?asset_id=${recipientId}`;
                                                
                                                const teleMsg = `${customerName} + ${pageName} đã nhắn tin: ${messageText} vào lúc ${vnTime} (giờ Việt Nam) , vui lòng truy cập link page ${pageLink} để trả lời`;
                                                
                                                await axios.post(`https://api.telegram.org/bot${teleToken}/sendMessage`, {
                                                    chat_id: chatId,
                                                    text: teleMsg
                                                }).catch(e => console.error('Telegram Handoff Error:', e.message));
                                            }
                                            return; // Dừng AI
                                        }
                                    }

                                    // BƯỚC 1: QUICK REPLIES
                                    const qrRes = await pool.query('SELECT replies FROM chatbot_quick_replies WHERE page_id = $1', [recipientId]);
                                    const quickReplies = qrRes.rows[0]?.replies || [];
                                    let matchedQR = quickReplies.find(qr => 
                                        qr.keywords.split(',').map(k => k.trim().toLowerCase()).some(k => messageText.toLowerCase().includes(k))
                                    );

                                    if (matchedQR) {
                                        if (matchedQR.answer) {
                                            await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${page.page_access_token}`, {
                                                recipient: { id: senderId },
                                                message: { text: matchedQR.answer }
                                            }).catch(e => console.error('QR Text Send Error:', e.message));
                                        }

                                        if (matchedQR.media && matchedQR.media.startsWith('data:')) {
                                            try {
                                                const matches = matchedQR.media.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                                                if (matches && matches.length === 3) {
                                                    const mimeType = matches[1];
                                                    const buffer = Buffer.from(matches[2], 'base64');
                                                    const type = mimeType.startsWith('video/') ? 'video' : 'image';
                                                    
                                                    const formData = new FormData();
                                                    formData.append('recipient', JSON.stringify({ id: senderId }));
                                                    formData.append('message', JSON.stringify({
                                                        attachment: { type: type, payload: { is_reusable: false } }
                                                    }));
                                                    
                                                    const ext = mimeType.split('/')[1] || (type === 'video' ? 'mp4' : 'png');
                                                    const blob = new Blob([buffer], { type: mimeType });
                                                    formData.append('filedata', blob, `attachment.${ext}`);
                                                    
                                                    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${page.page_access_token}`, {
                                                        method: 'POST',
                                                        body: formData
                                                    });
                                                }
                                            } catch (err) {
                                                console.error('QR Media Send Error:', err.message);
                                            }
                                        }

                                        broadcastMessage({
                                            type: 'new_facebook_message',
                                            pageId: recipientId, senderId: recipientId,
                                            message: { text: matchedQR.answer || '[Đã gửi đính kèm Media]', mid: 'qr_' + Date.now() },
                                            isEcho: true
                                        });
                                        return;
                                    }

                                    // BƯỚC 2: AI
                                    const promptRes = await pool.query('SELECT prompt FROM chatbot_prompt WHERE page_id = $1', [recipientId]);
                                    const customPrompt = promptRes.rows[0]?.prompt;
                                    let systemInstruction = "Bạn là trợ lý AI của GENZTECH. ";
                                    if (customPrompt) systemInstruction += `Chỉ dẫn: ${customPrompt}. Hãy trả lời tự nhiên.`;

                                    const aiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
                                        model: 'gpt-4o',
                                        messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: messageText }],
                                        temperature: 0.7
                                    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });

                                    const replyText = aiRes.data.choices[0].message.content;
                                    await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${page.page_access_token}`, {
                                        recipient: { id: senderId },
                                        message: { text: replyText }
                                    });
                                    broadcastMessage({
                                        type: 'new_facebook_message',
                                        pageId: recipientId, senderId: recipientId,
                                        message: { text: replyText, mid: 'ai_' + Date.now() },
                                        isEcho: true
                                    });
                                }
                            } catch (err) { console.error('AI Error:', err.message); }
                        })();
                    }
                }
            });
        });
        res.status(200).send('EVENT_RECEIVED');
    } else if (body.object === 'user') {
        console.log('👤 [REAL-TIME] User Webhook:', body);
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// --- CRM TODO API ---
app.get('/api/crm/todos', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: 'Email required' });
        const dbRes = await pool.query('SELECT * FROM crm_todos WHERE google_email = $1 ORDER BY created_at DESC', [email]);
        res.json(dbRes.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/crm/todos', async (req, res) => {
    try {
        const { email, text } = req.body;
        if (!email || !text) return res.status(400).json({ error: 'Missing info' });
        const dbRes = await pool.query('INSERT INTO crm_todos (google_email, todo_text) VALUES ($1, $2) RETURNING *', [email, text]);
        res.json(dbRes.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/crm/todos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_done } = req.body;
        await pool.query('UPDATE crm_todos SET is_done = $1 WHERE id = $2', [is_done, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/crm/todos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM crm_todos WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BROWSER PUSH API (Gửi tức thời từ Dashboard) ---
app.post('/api/notifications/send', async (req, res) => {
    const { chat_id, message } = req.body;
    if (!process.env.TELEGRAM_BOT_TOKEN || !chat_id || !message) {
        return res.status(400).json({ error: 'Thiếu thông tin' });
    }
    try {
        await pool.query(
            `INSERT INTO user_notifications (telegram_id, last_report, last_sent)
             VALUES ($1, $2, NOW())
             ON CONFLICT (telegram_id) DO UPDATE SET last_report = $2, last_sent = NOW()`,
            [chat_id.toString(), message]
        );
        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chat_id, text: message, parse_mode: 'HTML'
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Send Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Lỗi gửi tin' });
    }
});

// --- SERVER-SIDE 24/7 REPORTING ENGINE ---
const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtCur = (v) => '₫' + Math.round(parseFloat(v) || 0).toLocaleString('vi-VN');
const fmtPct = (v) => (parseFloat(v) || 0).toFixed(2) + '%';
const fmtRoas = (v) => (parseFloat(v) || 0).toFixed(2) + 'x';
const parseRoas = (raw) => {
    if (!raw) return 0;
    if (Array.isArray(raw)) return parseFloat(raw[0]?.value || 0) || 0;
    return parseFloat(raw) || 0;
};

// Helper: Lấy ngày hôm nay theo giờ Việt Nam
function getTodayVN() {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return vnTime.toISOString().split('T')[0];
}



async function fetchAndSendAllReports() {
    console.log('⏰ [Engine] Starting automated sync process NOW...');
    try {
        const totalRows = await pool.query('SELECT COUNT(*) FROM user_notifications');
        const users = await pool.query('SELECT * FROM user_notifications WHERE fb_access_token IS NOT NULL AND telegram_id IS NOT NULL');
        console.log(`👤 [Engine] DB Status: Total rows: ${totalRows.rows[0].count}, Valid users for sync: ${users.rows.length}`);

        for (const user of users.rows) {
            const ownerName = user.fb_name || user.telegram_id || 'Khách';
            try {
                const token = user.fb_access_token;
                const chatId = user.telegram_id;
                const today = getTodayVN();



                // 1. Lấy danh sách tài khoản (Ưu tiên danh sách ID từ trình duyệt gửi lên)
                let accountsMap = new Map();
                const dbAccountIds = user.account_ids ? (typeof user.account_ids === 'string' ? JSON.parse(user.account_ids) : user.account_ids) : [];
                
                if (dbAccountIds && dbAccountIds.length > 0) {
                    console.log(`   🎯 Using ${dbAccountIds.length} specific account IDs for ${ownerName}`);
                    // Fetch từng tài khoản trong danh sách ID
                    for (const id of dbAccountIds) {
                        try {
                            const accRes = await axios.get(`https://graph.facebook.com/v19.0/act_${id}?fields=name,account_id,account_status,timezone_name,timezone_offset_hours_utc,currency,balance,amount_spent,spend_cap,funding_source_details,created_time,insights.date_preset(today){spend,cpm,cpc,ctr,purchase_roas,impressions,reach,frequency,actions,inline_link_clicks,video_p100_watched_actions}&access_token=${token}`, { timeout: 10000 });
                            if (accRes.data) accountsMap.set(accRes.data.account_id, accRes.data);
                        } catch (err) { console.warn(`   ⚠️ Could not fetch specific account ${id}:`, err.message); }
                    }
                } 
                
                // Bổ sung quét thêm để không sót (nếu danh sách ID trống hoặc để check chéo)
                if (accountsMap.size === 0) {
                    console.log(`   🔎 [Engine] Scanning all accounts for ${ownerName}...`);
                    // A. Lấy từ danh sách cá nhân
                    let accUrl = `https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id,account_status,timezone_name,timezone_offset_hours_utc,currency,balance,amount_spent,spend_cap,funding_source_details,created_time,insights.date_preset(today){spend,cpm,cpc,ctr,purchase_roas,impressions,reach,frequency,actions,inline_link_clicks,video_p100_watched_actions}&limit=100&access_token=${token}`;
                    while (accUrl) {
                        const accRes = await axios.get(accUrl, { timeout: 20000 });
                        (accRes.data.data || []).forEach(a => accountsMap.set(a.account_id, a));
                        accUrl = accRes.data.paging?.next || null;
                        if (accountsMap.size > 500) break;
                    }
                }

                // B. Lấy từ tất cả Business Managers
                try {
                    const bmRes = await axios.get(`https://graph.facebook.com/v19.0/me/businesses?fields=adaccounts{name,account_id,account_status,timezone_name,timezone_offset_hours_utc,currency,balance,amount_spent,spend_cap,funding_source_details,created_time,insights.date_preset(today){spend,cpm,cpc,ctr,purchase_roas,impressions,reach,frequency,actions,inline_link_clicks,video_p100_watched_actions}}&limit=100&access_token=${token}`, { timeout: 20000 });
                    (bmRes.data.data || []).forEach(bm => {
                        if (bm.adaccounts && bm.adaccounts.data) {
                            bm.adaccounts.data.forEach(a => accountsMap.set(a.account_id, a));
                        }
                    });
                } catch (bmErr) { console.warn(`   ⚠️ BM fetch failed for ${ownerName}:`, bmErr.message); }

                let accounts = Array.from(accountsMap.values());
                console.log(`   ✅ Found ${accounts.length} accounts for ${ownerName}`);

                if (accounts.length === 0) {
                    console.log(`   ⚠️ User ${ownerName}: No accounts found or token invalid.`);
                    continue;
                }

                console.log(`   📨 [Engine] Generating Telegram report for ${ownerName}...`);

                let totalSpendAll = 0;
                let allAccountsData = [];

                for (const acc of accounts) {
                    try {
                        const ins = acc.insights?.data?.[0];
                        const accData = {
                            id: acc.account_id,
                            name: acc.name || acc.account_id,
                            status: acc.account_status,
                            currency: acc.currency,
                            timezone: acc.timezone_name,
                            timezone_offset: acc.timezone_offset_hours_utc,
                            daily_spend_limit: 0,
                            spend_cap: acc.spend_cap || 0,
                            threshold: 0,
                            balance: parseFloat(acc.balance || 0) / 100,
                            amount_spent: acc.amount_spent || 0,
                            card_info: acc.funding_source_details?.display_string || '---',
                            created_time: acc.created_time,
                            spend: ins?.spend || 0,
                            cpm: ins?.cpm || 0,
                            cpc: ins?.cpc || 0,
                            ctr: ins?.ctr || 0,
                            impressions: ins?.impressions || 0,
                            reach: ins?.reach || 0,
                            purchase_roas: parseRoas(ins?.purchase_roas),
                            tree: {}
                        };

                        if (ins) { // Removed spend > 0 check to ensure hierarchy is always fetched
                            totalSpendAll += parseFloat(ins.spend || 0);
                                // Query chi tiết Ads
                                let adsRes;
                                try {
                                    adsRes = await axios.get(`https://graph.facebook.com/v19.0/act_${acc.account_id}/insights?level=ad&date_preset=today&fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,cpm,cpc,ctr,purchase_roas,actions,impressions,reach,frequency,inline_link_clicks,outbound_clicks,video_30_sec_watched_actions,video_p25_watched_actions,video_p100_watched_actions&limit=500&access_token=${token}`, { timeout: 15000 });
                                    
                                    // FALLBACK: Nếu không có dữ liệu insights ở level=ad, thử quét qua danh sách Ads
                                    if (!adsRes.data.data || adsRes.data.data.length === 0) {
                                        console.log(`      ⚠️ Level=ad empty for ${acc.account_id}, trying /ads fallback...`);
                                        const fallbackRes = await axios.get(`https://graph.facebook.com/v19.0/act_${acc.account_id}/ads?fields=name,insights.date_preset(today){spend,cpm,cpc,ctr,purchase_roas,actions,impressions,reach,frequency,inline_link_clicks,outbound_clicks,video_30_sec_watched_actions,video_p25_watched_actions,video_p100_watched_actions},adset{id,name},campaign{id,name}&limit=100&access_token=${token}`, { timeout: 15000 });
                                        
                                        const fallbackData = (fallbackRes.data.data || []).map(ad => {
                                            const ins = ad.insights?.data?.[0];
                                            if (!ins || parseFloat(ins.spend) === 0) return null;
                                            return {
                                                ...ins,
                                                ad_id: ad.id, ad_name: ad.name,
                                                adset_id: ad.adset?.id, adset_name: ad.adset?.name,
                                                campaign_id: ad.campaign?.id, campaign_name: ad.campaign?.name
                                            };
                                        }).filter(Boolean);
                                        
                                        adsRes.data.data = fallbackData;
                                    }
                                } catch (e) {
                                    console.error(`      ❌ Error fetching ad-level insights for ${acc.account_id}:`, e.message);
                                }
                                
                                const tree = {};
                                const insightsData = adsRes?.data?.data || [];
                                
                                if (insightsData.length > 0) {
                                    insightsData.forEach(ai => {
                                        const cName = ai.campaign_name || 'Chiến dịch không tên';
                                const sName = ai.adset_name || 'Nhóm không tên';
                                const adName = ai.ad_name || 'Quảng cáo không tên';

                                if (!tree[cName]) {
                                    tree[cName] = { 
                                        spend: 0, msg: 0, replies: 0, link_clicks: 0, outbound_clicks: 0, 
                                        impressions: 0, reach: 0, v30: 0, vp25: 0, vp100: 0,
                                        roas: 0, sets: {},
                                        status: 'ACTIVE', budget: 0, 
                                        stop_time: null, objective: 'UNKNOWN' 
                                    };
                                }
                                if (!tree[cName].sets[sName]) {
                                    tree[cName].sets[sName] = { 
                                        spend: 0, results: 0, replies: 0, link_clicks: 0, outbound_clicks: 0,
                                        impressions: 0, reach: 0, v30: 0, vp25: 0, vp100: 0,
                                        roas: 0, ads: [],
                                        status: 'ACTIVE', budget: 0,
                                        start_time: null, stop_time: null,
                                        bid_strategy: 'UNKNOWN'
                                    };
                                }

                                const s = parseFloat(ai.spend) || 0;
                                const r = parseRoas(ai.purchase_roas);
                                const c = tree[cName];
                                const set = c.sets[sName];
                                
                                c.spend += s;
                                c.roas += r;
                                c.impressions += parseInt(ai.impressions || 0);
                                c.reach += parseInt(ai.reach || 0);

                                set.spend += s;
                                set.roas += r;
                                set.impressions += parseInt(ai.impressions || 0);
                                set.reach += parseInt(ai.reach || 0);

                                if (ai.actions) {
                                    ai.actions.forEach(act => {
                                        if (act.action_type === 'messaging_conversation_started_7d') {
                                            const val = parseInt(act.value);
                                            c.msg += val;
                                            set.results += val;
                                            // Mapping thêm trường results cho thống nhất
                                            ai.results = (ai.results || 0) + val;
                                        }
                                        if (act.action_type === 'text_reply') {
                                            c.replies += parseInt(act.value);
                                            set.replies += parseInt(act.value);
                                        }
                                        if (act.action_type === 'link_click') {
                                            c.link_clicks += parseInt(act.value);
                                            set.link_clicks += parseInt(act.value);
                                        }
                                        if (act.action_type === 'outbound_click') {
                                            c.outbound_clicks += parseInt(act.value);
                                            set.outbound_clicks += parseInt(act.value);
                                        }
                                    });
                                }

                                // Video metrics
                                const v30 = parseInt(ai.video_30_sec_watched_actions?.[0]?.value || 0);
                                const v25 = parseInt(ai.video_p25_watched_actions?.[0]?.value || 0);
                                const v100 = parseInt(ai.video_p100_watched_actions?.[0]?.value || 0);
                                c.v30 += v30; c.vp25 += v25; c.vp100 += v100;
                                set.v30 += v30; set.vp25 += v25; set.vp100 += v100;

                                set.ads.push({
                                    name: adName,
                                    status: 'ACTIVE',
                                    spend: s,
                                    roas: r,
                                    impressions: parseInt(ai.impressions || 0),
                                    reach: parseInt(ai.reach || 0),
                                    frequency: parseFloat(ai.frequency || 1),
                                    cpc: ai.cpc || 0,
                                    cpm: ai.cpm || 0,
                                    ctr: ai.ctr || 0,
                                    msg: parseInt(ai.actions?.find(a => a.action_type === 'messaging_conversation_started_7d')?.value || 0),
                                    replies: parseInt(ai.actions?.find(a => a.action_type === 'text_reply')?.value || 0),
                                    link_clicks: parseInt(ai.actions?.find(a => a.action_type === 'link_click')?.value || 0),
                                    outbound_clicks: parseInt(ai.actions?.find(a => a.action_type === 'outbound_click')?.value || 0),
                                    v30: v30, vp25: v25, vp100: v100
                                });
                            });
                                                    }
                            accData.tree = tree;
                        }
                        allAccountsData.push(accData);
                    } catch (accErr) {
                        console.error(`      ❌ Error for account ${acc.account_id}:`, accErr.message);
                    }
                }

                if (allAccountsData.length > 0) {
                    const nowVN = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                    const spentAccounts = allAccountsData.filter(acc => parseFloat(acc.spend) > 0);

                    const listHtml = spentAccounts.map(accData => {
                        let treeInfo = '';
                        if (accData.tree) {
                            Object.entries(accData.tree).forEach(([cName, cData]) => {
                                treeInfo += `\n   ▫️ <b>CD:</b> ${esc(cName)} (${fmtCur(cData.spend)})\n`;
                                Object.entries(cData.sets).forEach(([sName, sData]) => {
                                    treeInfo += `     🔹 <b>Nhóm:</b> ${esc(sName)}\n`;
                                    sData.ads.forEach(ad => {
                                        treeInfo += `        🔸 <b>QC:</b> ${esc(ad.name)}\n` +
                                            `        💰 ${fmtCur(ad.spend)} | CPC: ${fmtCur(ad.cpc)}\n` +
                                            `        📊 CPM: ${fmtCur(ad.cpm)} | CTR: ${fmtPct(ad.ctr)}\n` +
                                            `        📈 ROAS: ${fmtRoas(ad.roas)}\n`;
                                    });
                                });
                            });
                        }

                        return `🏢 <b>TK: ${esc(accData.name)}</b>\n` +
                            `💵 Tiêu: ${fmtCur(accData.spend)} | CPC: ${fmtCur(accData.cpc)}\n` +
                            `📊 CPM: ${fmtCur(accData.cpm)} | CTR: ${fmtPct(accData.ctr)}\n` +
                            `📈 ROAS: ${fmtRoas(accData.purchase_roas)}${treeInfo}`;
                    }).join('\n\n');

                    if (spentAccounts.length === 0) {
                        console.log(`   ⏭️ No spending accounts for ${ownerName}, skip Telegram message.`);
                        await pool.query('UPDATE user_notifications SET ads_data = $1 WHERE id = $2', [JSON.stringify(allAccountsData), user.id]);
                        continue;
                    }

                    const message =
                        `📊 <b>BÁO CÁO CHI TIẾT (NGÀY HÔM NAY)</b>\n` +
                        `━━━━━━━━━━━━━━━━━━\n\n` +
                        `👤 Chủ sở hữu: ${esc(ownerName)}\n` +
                        `💰 <b>TỔNG TIÊU: ${fmtCur(totalSpendAll)}</b>\n\n` +
                        `✅ <b>DANH SÁCH HOẠT ĐỘNG:</b>\n${listHtml}\n\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `🕒 Cập nhật VN: ${nowVN}\n` +
                        `🔄 Chu kỳ: 10 phút/lần`;

                    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        chat_id: chatId, text: message, parse_mode: 'HTML'
                    }, { timeout: 20000 });
                    
                    console.log(`💥 [Engine] BOOM! Report sent to Telegram for ${ownerName}`);
                    
                    const savedNames = allAccountsData.map(a => a.name).join(', ');
                    console.log(`   💾 Saving ${allAccountsData.length} accounts for ${ownerName}: ${savedNames}`);
                    await pool.query('UPDATE user_notifications SET last_report = $1, ads_data = $2, last_sent = NOW() WHERE id = $3', [message, JSON.stringify(allAccountsData), user.id]);

                    // 📊 GOOGLE SHEETS SYNC (Disabled as per user request)
                    /*
                    try {
                        const userRes = await pool.query('SELECT google_refresh_token FROM users WHERE id = $1', [user.id]);
                        const gToken = userRes.rows[0]?.google_refresh_token;
                        if (gToken) {
                            console.log(`   📊 Syncing ${allAccountsData.length} accounts to Sheets for ${ownerName}...`);
                            for (const acc of allAccountsData) {
                                try {
                                    const spreadsheetId = await getDailySheet(user, acc.name);
                                    if (spreadsheetId) {
                                        await updateGoogleSheet(spreadsheetId, [acc], user);
                                    }
                                } catch (accSheetErr) {
                                    // Silence per-account sheet errors
                                }
                            }
                        }
                    } catch (sheetErr) {
                        // Silently skip - user hasn't connected Google
                    }
                    */

                    console.log(`   ✅ Report & Sheets synced for ${ownerName} (${chatId})`);
                } else {
                    console.log(`   ⚠️ User ${ownerName}: No spend today.`);
                }
            } catch (error) {
                const errMsg = error.response?.data?.error?.message || error.message;
                console.error(`   ❌ Error fetching for ${ownerName}:`, errMsg);

                // Nếu lỗi do Token hết hạn, đánh dấu vào DB hoặc Log cụ thể
                if (errMsg.includes('access token') || errMsg.includes('expired')) {
                    console.warn(`   🔑 Token for ${ownerName} has EXPIRED. User needs to login again to refresh.`);
                }
            }
        }
        console.log('⏰ [CRON] Sync complete.');
    } catch (err) {
        console.error('❌ Global Sync Error:', err.message);
    }
}

// Hàm khởi chạy vòng lặp đồng bộ "Bất tử" (Chạy 24/7 trên Server)
async function startImmortalSync() {
    console.log('🚀 [Engine] Starting 24/7 Immortal Sync Loop...');
    // Đã xóa 5s delay để chạy ngay lập tức

    while (true) {
        const startTime = Date.now();
        const nowLoop = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        try {
            console.log(`⏰ [Engine] Periodic sync starting at ${nowLoop}...`);
            await fetchAndSendAllReports();
        } catch (err) {
            console.error('❌ [Engine] Loop Error:', err.message);
        }

        // Tính toán thời gian chờ để đảm bảo nhịp 10 phút (600,000ms)
        const duration = Date.now() - startTime;
        const waitTime = Math.max(1000, 600000 - duration);

        console.log(`💤 [Engine] Sleeping for ${Math.round(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
}

// Kích hoạt vòng lặp được dời xuống cuối file


// --- WEBHOOK SETUP ---
async function setupWebhook() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const domain = "genztechcorp.com";
    if (token) {
        try {
            await axios.get(`https://api.telegram.org/bot${token}/setWebhook?url=https://${domain}/api/telegram/webhook`);
            console.log(`Webhook set: https://${domain}/api/telegram/webhook`);
        } catch (err) { console.error('Webhook Error:', err.message); }
    }
}
setupWebhook();



// --- DASHBOARD API ---
// 🔄 Endpoint kích hoạt quét dữ liệu ngay lập tức (không đợi cron)
app.post('/api/dashboard/refresh-sync', async (req, res) => {
    try {
        console.log('🚀 Manual Sync triggered from UI...');
        // Chạy tiến trình quét và đợi nó hoàn thành
        await fetchAndSendAllReports();
        res.json({ success: true, message: 'Sync process completed' });
    } catch (error) {
        console.error('Manual Sync Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/dashboard', async (req, res) => {
    try {
        const { telegram_id, fb_name } = req.query;
        if (!telegram_id && !fb_name) return res.status(400).json({ error: 'Missing telegram_id or fb_name' });

        let dbRes;
        if (telegram_id) {
            dbRes = await pool.query('SELECT ads_data FROM user_notifications WHERE telegram_id = $1', [telegram_id.toString()]);
        } else {
            dbRes = await pool.query('SELECT ads_data FROM user_notifications WHERE fb_name = $1', [fb_name]);
        }
        if (dbRes.rows.length === 0 || !dbRes.rows[0].ads_data) {
            return res.json({ overview: [], message: 'No data yet' });
        }

        const adsData = dbRes.rows[0].ads_data;
        // Transform for dashboard if needed, or return raw
        res.json({
            overview: adsData,
            last_updated: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- LOGIN API ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const dbRes = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
        if (dbRes.rows.length > 0) res.json({ success: true, message: 'Đăng nhập thành công' });
        else res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });
    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
    }
});

// --- GZCHAT ATTACHMENT API ---
app.post('/api/gzchat/send-attachment', async (req, res) => {
    try {
        const { recipientId, pageToken, type, base64Data, fileName } = req.body;
        if (!base64Data) return res.status(400).json({ error: 'No data' });

        // Extract binary data from base64
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches) {
            console.error('❌ Invalid base64 format');
            return res.status(400).json({ error: 'Invalid base64 format' });
        }
        const buffer = Buffer.from(matches[2], 'base64');
        const mimeType = matches[1];

        const formData = new FormData();
        formData.append('recipient', JSON.stringify({ id: recipientId }));
        formData.append('message', JSON.stringify({
            attachment: {
                type: type || 'image',
                payload: { is_reusable: true }
            }
        }));

        const blob = new Blob([buffer], { type: mimeType });
        formData.append('filedata', blob, fileName || 'upload.png');

        const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`, {
            method: 'POST',
            body: formData
        });

        const fbData = await fbRes.json();
        res.json(fbData);
    } catch (err) {
        console.error('FB Attachment Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- DECENTRALIZATION API ---
// --- API: LIST DAILY REPORTS ---
app.get('/api/sheets/list', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT account_name, spreadsheet_id, report_date FROM daily_reports ORDER BY report_date DESC, account_name ASC');
        res.json({ success: true, reports: dbRes.rows });
    } catch (err) {
        console.error('List Sheets Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- API: PREVIEW SHEET DATA ---
app.get('/api/sheets/preview/:spreadsheetId', async (req, res) => {
    try {
        const { spreadsheetId } = req.params;
        const { level, access_token } = req.query; // campaign, adset, ad

        // 🛡️ TỰ ĐỘNG KHÔI PHỤC SESSION NẾU CÓ TOKEN
        if (!req.session?.user && access_token) {
            const userRes = await pool.query('SELECT id, fb_name FROM user_notifications WHERE fb_access_token = $1', [access_token]);
            if (userRes.rows.length > 0) {
                req.session.user = { id: userRes.rows[0].id, username: userRes.rows[0].fb_name };
            }
        }

        if (!req.session?.user) return res.status(401).json({ error: 'Phiên đăng nhập hết hạn. Vui lòng F5 trang.' });

        const userRes = await pool.query('SELECT google_refresh_token FROM users WHERE id = $1', [req.session.user.id]);
        const refreshToken = userRes.rows[0]?.google_refresh_token;
        if (!refreshToken) return res.status(401).json({ error: 'Chưa kết nối Google' });

        const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'postmessage');
        auth.setCredentials({ refresh_token: refreshToken });
        const sheets = google.sheets({ version: 'v4', auth });

        const tabMap = { 'campaign': 'Campaigns', 'adset': 'AdSets', 'ad': 'Ads' };
        const tabName = tabMap[level] || 'Campaigns';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${tabName}!A2:Z100`, // Lấy 100 dòng gần nhất
        });

        res.json({ success: true, rows: response.data.values || [] });
    } catch (err) {
        console.error('Preview Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const { owner_email } = req.query;
        let query = 'SELECT id, username, role, created_at FROM users';
        let params = [];
        
        if (owner_email) {
            query += ' WHERE owner_email = $1';
            params.push(owner_email);
        }
        
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const { username, password, role, owner_email } = req.body;
        const result = await pool.query(
            'INSERT INTO users (username, password, role, owner_email) VALUES ($1, $2, $3, $4) RETURNING id, username, role',
            [username, password, role || 'staff', owner_email]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const { owner_email } = req.query;
        if (!owner_email) return res.status(400).json({ error: 'owner_email required for verification' });
        
        // Verify ownership before delete
        const check = await pool.query('SELECT id FROM users WHERE id = $1 AND owner_email = $2', [req.params.id, owner_email]);
        if (check.rows.length === 0) return res.status(403).json({ error: 'Permission denied' });

        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/:id/access', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resource_access WHERE user_id = $1', [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users/:id/access', async (req, res) => {
    try {
        const { resource_id, resource_name, resource_type } = req.body;
        const result = await pool.query(
            'INSERT INTO resource_access (user_id, resource_id, resource_name, resource_type) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING *',
            [req.params.id, resource_id, resource_name, resource_type]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id/access/:resource_id', async (req, res) => {
    try {
        await pool.query('DELETE FROM resource_access WHERE user_id = $1 AND resource_id = $2', [req.params.id, req.params.resource_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/stores', async (req, res) => {
    try {
        const { owner_email } = req.query;
        let query = 'SELECT * FROM stores';
        let params = [];
        if (owner_email) {
            query += ' WHERE owner_email = $1';
            params.push(owner_email);
        }
        query += ' ORDER BY created_at DESC';
        const dbRes = await pool.query(query, params);
        res.json(dbRes.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/stores', async (req, res) => {
    try {
        const { name, page_ids, owner_email } = req.body;
        const dbRes = await pool.query(
            'INSERT INTO stores (name, page_ids, owner_email) VALUES ($1, $2, $3) RETURNING *',
            [name, JSON.stringify(page_ids || []), owner_email]
        );
        res.json(dbRes.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM stores WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ORDER TRACKING API (Updated with Store Filter) ---
app.get('/api/orders', async (req, res) => {
    try {
        const { store_id } = req.query;
        let query = 'SELECT * FROM product_orders';
        let params = [];
        if (store_id) {
            query += ' WHERE store_id = $1';
            params.push(store_id);
        }
        query += ' ORDER BY created_at DESC';
        const dbRes = await pool.query(query, params);
        res.json(dbRes.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { store_id, product_name, inventory, image_url, price, notes } = req.body;
        const dbRes = await pool.query(
            'INSERT INTO product_orders (store_id, product_name, inventory, image_url, price, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [store_id, product_name, parseInt(inventory) || 0, image_url, parseFloat(price) || 0, notes]
        );
        res.json(dbRes.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SALES HISTORY API ---
app.get('/api/sales', async (req, res) => {
    try {
        const { store_id } = req.query;
        let query = 'SELECT s.*, p.product_name FROM sales_history s LEFT JOIN product_orders p ON s.product_id = p.id';
        let params = [];
        if (store_id) {
            query += ' WHERE s.store_id = $1';
            params.push(store_id);
        }
        query += ' ORDER BY s.created_at DESC';
        const dbRes = await pool.query(query, params);
        res.json(dbRes.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { store_id, product_id, customer_name, quantity, total_price } = req.body;

        // 1. Record sale
        const saleRes = await client.query(
            'INSERT INTO sales_history (store_id, product_id, customer_name, quantity, total_price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [store_id, product_id, customer_name, parseInt(quantity) || 1, parseFloat(total_price)]
        );

        // 2. Decrease inventory
        await client.query(
            'UPDATE product_orders SET inventory = inventory - $1 WHERE id = $2',
            [parseInt(quantity) || 1, product_id]
        );

        await client.query('COMMIT');
        res.json(saleRes.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// --- PAGE CONFIG API ---
// Create table if not exists
pool.query(`CREATE TABLE IF NOT EXISTS page_configs (
    id SERIAL PRIMARY KEY,
    page_id TEXT UNIQUE NOT NULL,
    config_text TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT NOW()
)`).catch(err => console.warn('page_configs table:', err.message));

// List pages from Facebook
app.get('/api/pages/list', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Token required' });
        const fbRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,picture{url}&limit=100&access_token=${token}`, { timeout: 10000 });
        const pages = (fbRes.data.data || []).map(p => ({
            id: p.id,
            name: p.name,
            picture: p.picture?.data?.url || ''
        }));
        res.json(pages);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all saved configs
app.get('/api/pages/configs', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT page_id, config_text FROM page_configs');
        res.json(dbRes.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Save config for a page
app.post('/api/pages/config', async (req, res) => {
    try {
        const { page_id, config_text } = req.body;
        if (!page_id) return res.status(400).json({ error: 'page_id required' });
        await pool.query(
            `INSERT INTO page_configs (page_id, config_text, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (page_id) DO UPDATE SET config_text = $2, updated_at = NOW()`,
            [page_id, config_text || '']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CHATBOT CONFIG API ---
// Migration: Đảm bảo bảng chatbot_prompt dùng cấu hình theo từng page_id
(async () => {
    try {
        const check = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='chatbot_prompt' AND column_name='page_id'");
        if (check.rows.length === 0) {
            console.log("🔄 Migrating chatbot_prompt table...");
            await pool.query("DROP TABLE IF EXISTS chatbot_prompt");
            await pool.query(`CREATE TABLE chatbot_prompt (
                page_id TEXT PRIMARY KEY,
                prompt TEXT DEFAULT '',
                updated_at TIMESTAMP DEFAULT NOW()
            )`);
            console.log("✅ chatbot_prompt migrated successfully.");
        }
    } catch (err) { console.error("Migration Error:", err.message); }
})();

pool.query(`CREATE TABLE IF NOT EXISTS chatbot_quick_replies (
    page_id TEXT PRIMARY KEY,
    replies JSONB DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT NOW()
)`).catch(err => console.warn('chatbot_quick_replies table:', err.message));

// Migration: Đảm bảo bảng chatbot_quick_replies dùng cấu hình theo từng page_id
(async () => {
    try {
        const check = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='chatbot_quick_replies' AND column_name='page_id'");
        if (check.rows.length === 0) {
            console.log("🔄 Migrating chatbot_quick_replies table...");
            await pool.query("DROP TABLE IF EXISTS chatbot_quick_replies");
            await pool.query(`CREATE TABLE chatbot_quick_replies (
                page_id TEXT PRIMARY KEY,
                replies JSONB DEFAULT '[]',
                updated_at TIMESTAMP DEFAULT NOW()
            )`);
            console.log("✅ chatbot_quick_replies migrated successfully.");
        }
    } catch (err) { console.error("Migration Error QR:", err.message); }
})();

// Get prompt by page_id
app.get('/api/chatbot/prompt', async (req, res) => {
    try {
        const { page_id } = req.query;
        if (!page_id) return res.json({ prompt: '' });
        const r = await pool.query('SELECT prompt FROM chatbot_prompt WHERE page_id = $1', [page_id]);
        res.json(r.rows[0] || { prompt: '' });
    } catch (err) { res.json({ prompt: '' }); }
});

// Save prompt by page_id
app.post('/api/chatbot/prompt', async (req, res) => {
    try {
        const { prompt, page_id } = req.body;
        if (!page_id) return res.status(400).json({ error: 'page_id is required' });
        await pool.query(
            `INSERT INTO chatbot_prompt (page_id, prompt, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (page_id) DO UPDATE SET prompt = $2, updated_at = NOW()`,
            [page_id, prompt || '']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get quick replies by page_id
app.get('/api/chatbot/quick-replies', async (req, res) => {
    try {
        const { page_id } = req.query;
        if (!page_id) return res.json([]);
        const r = await pool.query('SELECT replies FROM chatbot_quick_replies WHERE page_id = $1', [page_id]);
        res.json(r.rows[0]?.replies || []);
    } catch (err) { res.json([]); }
});

// Save quick replies by page_id
app.post('/api/chatbot/quick-replies', async (req, res) => {
    try {
        const { replies, page_id } = req.body;
        if (!page_id) return res.status(400).json({ error: 'page_id is required' });
        await pool.query(
            `INSERT INTO chatbot_quick_replies (page_id, replies, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (page_id) DO UPDATE SET replies = $2, updated_at = NOW()`,
            [page_id, JSON.stringify(replies || [])]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- HANDOFF CONFIG API ---
pool.query(`CREATE TABLE IF NOT EXISTS chatbot_handoff_config (
    page_id TEXT PRIMARY KEY,
    keywords TEXT DEFAULT '',
    chat_id TEXT DEFAULT '8585365345',
    updated_at TIMESTAMP DEFAULT NOW()
)`).catch(err => console.warn('chatbot_handoff_config table:', err.message));

// Get handoff config by page_id
app.get('/api/chatbot/handoff', async (req, res) => {
    try {
        const { page_id } = req.query;
        if (!page_id) return res.json({});
        const r = await pool.query('SELECT keywords, chat_id FROM chatbot_handoff_config WHERE page_id = $1', [page_id]);
        res.json(r.rows[0] || {});
    } catch (err) { res.json({}); }
});

// Save handoff config by page_id
app.post('/api/chatbot/handoff', async (req, res) => {
    try {
        const { page_id, keywords, chat_id } = req.body;
        if (!page_id) return res.status(400).json({ error: 'page_id is required' });
        await pool.query(
            `INSERT INTO chatbot_handoff_config (page_id, keywords, chat_id, updated_at) VALUES ($1, $2, $3, NOW())
             ON CONFLICT (page_id) DO UPDATE SET keywords = $2, chat_id = $3, updated_at = NOW()`,
            [page_id, keywords || '', chat_id || '8585365345']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload file for quick reply attachment (no external dependencies)
app.post('/api/chatbot/upload', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
    if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'No file' });
    const base64 = req.body.toString('base64');
    const mimeType = req.headers['content-type'] || 'application/octet-stream';
    const url = `data:${mimeType};base64,${base64}`;
    res.json({ url });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    // Khởi chạy vòng lặp đồng bộ sau khi server đã bật
    startImmortalSync();
});
