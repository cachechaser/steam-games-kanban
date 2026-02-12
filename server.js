    import express from 'express';
    import { createProxyMiddleware } from 'http-proxy-middleware';
    import path from 'path';
    import { fileURLToPath } from 'url';

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const app = express();
    const port = process.env.SERVER_PORT || 3000;

    // Proxy Steam API calls (Matches your useSteam.js)
    app.use('/api/steam', createProxyMiddleware({
        target: 'https://api.steampowered.com',
        changeOrigin: true,
        pathRewrite: { '^/api/steam': '' }
    }));

    // Serve Vue App
    app.use(express.static(path.join(__dirname, 'dist')));

    // Handle SPA Routing (Reloads work correctly)
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });

    app.listen(port, () => console.log(`App running on port ${port}`));
    