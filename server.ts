import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer } from 'ws';
import type { Request, Response, NextFunction } from 'express';
import { attachSignaling } from './lib/signaling';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = Number(process.env.SERVER_PORT || 3000);

export const getServerSteamApiKey = (): string => {
    const key = process.env.STEAM_WEB_API_KEY || process.env.STEAM_API_KEY;
    return typeof key === 'string' ? key.trim() : '';
};

export const sanitizeUrlForLogs = (url = ''): string => {
    try {
        const parsed = new URL(url, 'http://localhost');
        if (parsed.searchParams.has('key')) {
            parsed.searchParams.set('key', '[REDACTED]');
        }
        return `${parsed.pathname}${parsed.search}`.replace(/key=%5BREDACTED%5D/gi, 'key=[REDACTED]');
    } catch {
        return String(url).replace(/([?&]key=)[^&]+/i, '$1[REDACTED]');
    }
};

const STEAM_API_TARGET = 'https://api.steampowered.com';

const readRawBody = async (req: Request): Promise<Buffer | undefined> => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return undefined;
    }

    return await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)));
        req.on('error', reject);
    });
};

type SteamPathResolution =
    | { missingKey: true }
    | { missingKey: false; keySource: 'user' | 'server'; path: string };

export const resolveSteamRequestPath = (incomingPath = ''): SteamPathResolution => {
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

export const createServerApp = () => {
    const app = express();
    const server = http.createServer(app);

    // --- WebRTC Signaling via WebSocket ---
    const wss = new WebSocketServer({ server, path: '/ws/signal' });
    attachSignaling(wss);

    // Enhanced Request Logging Middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();
        const clientIP = req.ip || req.socket.remoteAddress || 'Unknown';
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

    app.get('/api/steam/config', (_req: Request, res: Response) => {
        res.json({ hasServerApiKey: Boolean(getServerSteamApiKey()) });
    });

    app.use('/api/steam', (req: Request, res: Response, next: NextFunction) => {
        const resolved = resolveSteamRequestPath(req.url);

        if (resolved.missingKey) {
            res.status(400).json({
                error: 'Steam API key not configured.',
                message: 'Set STEAM_WEB_API_KEY (or STEAM_API_KEY) on the server, or provide a user key override in the client.'
            });
            return;
        }

        const resolvedWithKey = resolved as Extract<SteamPathResolution, { missingKey: false }>;

        req.steamResolvedPath = resolvedWithKey.path;
        req.steamKeySource = resolvedWithKey.keySource;
        next();
    });

    // Proxy Steam API calls without http-proxy-middleware to avoid DEP0060 noise.
    app.use('/api/steam', async (req: Request, res: Response) => {
        const targetPath = req.steamResolvedPath || req.url;
        const safePath = sanitizeUrlForLogs(targetPath);

        console.log(`[Proxy Request] Forwarding to Steam API: ${safePath} | keySource=${req.steamKeySource || 'unknown'}`);

        try {
            const targetUrl = `${STEAM_API_TARGET}${targetPath}`;
            const body = await readRawBody(req);
            const headers: Record<string, string> = {};

            for (const [key, value] of Object.entries(req.headers)) {
                if (!value) continue;
                if (key.toLowerCase() === 'host' || key.toLowerCase() === 'content-length') continue;
                headers[key] = Array.isArray(value) ? value.join(',') : value;
            }

            const steamRes = await fetch(targetUrl, {
                method: req.method,
                headers,
                body: body ? new Uint8Array(body) : undefined,
                redirect: 'manual'
            });

            steamRes.headers.forEach((value, key) => {
                if (key.toLowerCase() === 'transfer-encoding') return;
                res.setHeader(key, value);
            });

            const responseBody = Buffer.from(await steamRes.arrayBuffer());
            console.log(`[Proxy Response] ${safePath} | status=${steamRes.status}`);
            res.status(steamRes.status).send(responseBody);
        } catch (err) {
            const error = err as Error & { code?: string };
            const clientIP = req.ip || req.socket.remoteAddress || 'Unknown';
            console.error(
                `[Proxy Error] ${error.code || error.message} | ` +
                `URL: ${safePath} | IP: ${clientIP} | Error: ${error.stack}`
            );
            res.status(502).json({ error: 'Failed to reach Steam API', details: error.message });
        }
    });

    // Serve Vue App
    app.use(express.static(path.join(__dirname, 'dist')));

    // Handle SPA Routing (Reloads work correctly)
    app.get('*', (req: Request, res: Response) => {
        const clientIP = req.ip || req.socket.remoteAddress || 'Unknown';
        console.log(`[SPA Fallback] Serving index.html for ${req.url} | IP: ${clientIP}`);
        res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
            if (err) {
                console.error(`[File Error] Failed to serve index.html: ${err.message}`);
                res.status(500).send('Internal Server Error');
            }
        });
    });

    // Global Error Handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        void next;
        const clientIP = req.ip || req.socket.remoteAddress || 'Unknown';
        console.error(
            `[Global Error] ${err.message} | URL: ${req.url} | IP: ${clientIP} | ` +
            `Stack: ${err.stack}`
        );
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    });

    return { app, server, wss };
};

export const startServer = (port = DEFAULT_PORT) => {
    const { server } = createServerApp();
    server.listen(port, () => {
        console.log(`App running on port ${port}`);
        console.log(`Node Version: ${process.version}`);
        console.log(`Serving static files from: ${path.join(__dirname, 'dist')}`);
        console.log(`WebSocket signaling available at ws://localhost:${port}/ws/signal`);
        console.log(`Server Steam API key configured: ${Boolean(getServerSteamApiKey())}`);
        console.log(`Server started at ${new Date().toISOString()}`);
    });
    return server;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    startServer();
}
