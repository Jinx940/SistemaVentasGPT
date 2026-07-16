import app from '../../backend/server.js';

export default function handler(req, res) {
  const requestUrl = typeof req.url === 'string' ? req.url : '/';

  if (requestUrl === '/api') {
    req.url = '/';
  } else if (requestUrl.startsWith('/api/')) {
    req.url = requestUrl.slice('/api'.length) || '/';
  }

  return app(req, res);
}
