import 'dotenv/config';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer } from 'ws';
import { attachSignaling } from './lib/signaling.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const port = process.env.SERVER_PORT || 3000;

const getServerSteamApiKey = () => {
    const key = process.env.STEAM_WEB_API_KEY || process.env.STEAM_API_KEY;
    return typeof key === 'string' ? key.trim() : '';
};

const sanitizeUrlForLogs = (url = '') => {
    try {
        const parsed = new URL(url, 'http://localhost');
        if (parsed.searchParams.has('key')) {
            parsed.searchParams.set('key', '[REDACTED]');
        }
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return String(url).replace(/([?&]key=)[^&]+/i, '$1[REDACTED]');
    }
};

const resolveSteamRequestPath = (incomingPath = '') => {
    const parsed = new URL(incomingPath, 'http://localhost');
    const userKey = parsed.searchParams.get('key')?.trim();
    const serverKey = getServerSteamApiKey();
    const effectiveKey = userKey || serverKey;

    if (!effectiveKey) {
        return { missingKey: true };
    }

    parsed.searchParams.set('key', effectiveKey);

    return {
        missingKey: false,
        keySource: userKey ? 'user' : 'server',
        path: `${parsed.pathname}${parsed.search}`
    };
};

// --- WebRTC Signaling via WebSocket ---
const wss = new WebSocketServer({ server, path: '/ws/signal' });
attachSignaling(wss);

// Enhanced Request Logging Middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
    const safeUrl = sanitizeUrlForLogs(req.originalUrl || req.url);
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusColor = res.statusCode >= 400 ? 'ERROR:' : 'INFO:';
        console.log(
            `${statusColor} [${new Date().toISOString()}] ${req.method} ${safeUrl} | ` +
            `Status: ${res.statusCode} | IP: ${clientIP} | Duration: ${duration}ms`
        );
    });
    
    next();
});

app.get('/api/steam/config', (req, res) => {
    res.json({ hasServerApiKey: Boolean(getServerSteamApiKey()) });
});

app.use('/api/steam', (req, res, next) => {
    const resolved = resolveSteamRequestPath(req.url);

    if (resolved.missingKey) {
        return res.status(400).json({
            error: 'Steam API key not configured.',
            message: 'Set STEAM_WEB_API_KEY (or STEAM_API_KEY) on the server, or provide a user key override in the client.'
        });
    }

    req.steamResolvedPath = resolved.path;
    req.steamKeySource = resolved.keySource;
    next();
});

// Proxy Steam API calls (Matches your useSteam.js)
app.use('/api/steam', createProxyMiddleware({
    target: 'https://api.steampowered.com',
    changeOrigin: true,
    pathRewrite: (path, req) => {
        if (req.steamResolvedPath) {
            return req.steamResolvedPath;
        }
        return path.replace(/^\/api\/steam/, '');
    },
    logger: console,
    on: {
        proxyReq: (proxyReq, req) => {
            const targetPath = req.steamResolvedPath || req.url;
            console.log(`[Proxy Request] Forwarding to Steam API: ${sanitizeUrlForLogs(targetPath)} | keySource=${req.steamKeySource || 'unknown'}`);
        },
        proxyRes: (proxyRes) => {
            console.log(`[Proxy Response] Steam API returned ${proxyRes.statusCode}`);
        },
        error: (err, req, res) => {
            const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
            console.error(
                `[Proxy Error] ${err.code || err.message} | ` +
                `URL: ${sanitizeUrlForLogs(req.url)} | IP: ${clientIP} | Error: ${err.stack}`
            );
            res.status(502).json({ error: 'Failed to reach Steam API', details: err.message });
        }
    }
}));

// Serve Vue App
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA Routing (Reloads work correctly)
app.get('*', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
    console.log(`[SPA Fallback] Serving index.html for ${req.url} | IP: ${clientIP}`);
    res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
        if (err) {
            console.error(`[File Error] Failed to serve index.html: ${err.message}`);
            res.status(500).send('Internal Server Error');
        }
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    void next;
    const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
    console.error(
        `[Global Error] ${err.message} | URL: ${req.url} | IP: ${clientIP} | ` +
        `Stack: ${err.stack}`
    );
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

server.listen(port, () => {
    console.log(`App running on port ${port}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`Serving static files from: ${path.join(__dirname, 'dist')}`);
    console.log(`WebSocket signaling available at ws://localhost:${port}/ws/signal`);
    console.log(`Server Steam API key configured: ${Boolean(getServerSteamApiKey())}`);
    console.log(`Server started at ${new Date().toISOString()}`);
});
