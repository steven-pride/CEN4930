const { app } = require('@azure/functions');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.ico': 'image/x-icon'
};

// Serves index.html at root (/) and static files under public/
app.http('serveDashboardHttp', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: '{*filePath}',
    handler: async (request, context) => {
        const requestedPath = request.params.filePath || 'index.html';
        const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, '');
        const fullPath = path.join(__dirname, '../../public', normalizedPath);

        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
            const indexPath = path.join(__dirname, '../../public/index.html');
            if (fs.existsSync(indexPath)) {
                return {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                    body: fs.readFileSync(indexPath, 'utf8')
                };
            }
            return { status: 404, body: 'Not Found' };
        }

        const ext = path.extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        return {
            status: 200,
            headers: { 'Content-Type': contentType },
            body: fs.readFileSync(fullPath)
        };
    }
});