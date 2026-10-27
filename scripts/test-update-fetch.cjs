/**
 * 必须运行于真实 Electron 的传输回归测试，覆盖 Node fetch 模拟无法发现的跳转差异。
 */
const { app } = require('electron');
const http = require('node:http');
const assert = require('node:assert/strict');
const timeout = setTimeout(() => {
  console.error('Electron transport test timed out');
  app.exit(1);
}, 15000);
timeout.unref();
app
  .whenReady()
  .then(async () => {
    const { fetchUpdate } = await import('../dist-electron/update-fetch.js');
    let targetHits = 0;
    const server = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/octet-stream');
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/target' });
        res.end();
      } else if (req.url === '/target') {
        targetHits++;
        res.end('verified bytes');
      } else if (req.url === '/truncated') {
        res.writeHead(200, { 'content-length': '100' });
        res.write('short');
        setTimeout(() => res.destroy(), 20);
      } else if (req.url === '/slow') {
        res.writeHead(200);
        res.write(Buffer.alloc(65536));
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      console.log('Testing redirect');
      const redirected = await fetchUpdate(`${base}/redirect`);
      assert.equal(redirected.status, 302);
      assert.equal(redirected.headers.get('location'), `${base}/target`);
      assert.equal(targetHits, 0, 'redirect must not be followed before caller validation');
      console.log('Testing body');
      assert.equal(
        await (await fetchUpdate(redirected.headers.get('location'))).text(),
        'verified bytes',
      );
      console.log('Testing truncated response');
      await assert.rejects(async () => (await fetchUpdate(`${base}/truncated`)).text());
      console.log('Testing abort');
      const controller = new AbortController();
      const slow = await fetchUpdate(`${base}/slow`, { signal: controller.signal });
      console.log('Slow headers received');
      const pending = slow.text();
      controller.abort();
      await assert.rejects(pending);
      console.log('Testing already aborted');
      const aborted = new AbortController();
      aborted.abort();
      await assert.rejects(fetchUpdate(`${base}/target`, { signal: aborted.signal }));
      console.log('Testing cancel');
      const cancelled = await fetchUpdate(`${base}/slow`);
      await cancelled.body.cancel();
      console.log('Cancelled body');
      console.log(
        'Electron update transport: redirects, body bytes, truncation, abort and cancellation passed.',
      );
    } finally {
      server.closeAllConnections();
      server.close();
    }
  })
  .then(
    () => app.exit(0),
    (error) => {
      console.error(error);
      app.exit(1);
    },
  );
