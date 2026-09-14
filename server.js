const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { checkDatabase } = require('./server/db');
const { handleApi } = require('./server/api');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

function contentTypeFor(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);

    if (requestPath === '/api/health') {
      try {
        const database = await checkDatabase();
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ ok: true, database }));
      } catch (error) {
        res.writeHead(503, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ ok: false, database: { configured: true, connected: false } }));
      }
      return;
    }

    if (requestPath.startsWith('/api/')) {
      await handleApi(req, res, requestPath);
      return;
    }

    const requestedFile = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const absolutePath = path.normalize(path.join(rootDir, requestedFile));
    const relativePath = path.relative(rootDir, absolutePath);
    const isInsideRoot = relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
    const indexPath = path.join(rootDir, 'index.html');

    if (!isInsideRoot && requestedFile !== 'index.html') {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    let filePath = absolutePath;
    let data = await readFileSafe(filePath);

    if (!data) {
      const hasExtension = path.extname(requestedFile).length > 0;
      if (hasExtension) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      filePath = indexPath;
      data = await readFileSafe(filePath);
    }

    if (!data) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Unable to load application files');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Server error: ${error.message}`);
  }
});

server.listen(port, () => {
  console.log(`탁구장 게임관리 시스템이 http://localhost:${port} 에서 실행 중입니다.`);
});
