import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.SERVER_PORT || 3000;

// Enhanced Request Logging Middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusColor = res.statusCode >= 400 ? 'ERROR:' : 'INFO:';
        console.log(
            `${statusColor} [${new Date().toISOString()}] ${req.method} ${req.url} | ` +
            `Status: ${res.statusCode} | IP: ${clientIP} | Duration: ${duration}ms`
        );
    });
    
    next();
});

// Proxy Steam API calls (Matches your useSteam.js)
app.use('/api/steam', createProxyMiddleware({
    target: 'https://api.steampowered.com',
    changeOrigin: true,
    pathRewrite: { '^/api/steam': '' },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy Request] Forwarding to Steam API: ${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy Response] Steam API returned ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
        const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
        console.error(
            `[Proxy Error] ${err.code || err.message} | ` +
            `URL: ${req.url} | IP: ${clientIP} | Error: ${err.stack}`
        );
        res.status(502).json({ error: 'Failed to reach Steam API', details: err.message });
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
    const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
    console.error(
        `[Global Error] ${err.message} | URL: ${req.url} | IP: ${clientIP} | ` +
        `Stack: ${err.stack}`
    );
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(port, () => {
    console.log(`App running on port ${port}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`Serving static files from: ${path.join(__dirname, 'dist')}`);
    console.log(`Server started at ${new Date().toISOString()}`);
});
