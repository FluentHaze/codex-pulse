import { net } from 'electron';

/** Expose redirects to the downloader: net.fetch rejects manual redirects. */
export const fetchUpdate: typeof fetch = async (input, init) => new Promise<Response>((resolve, reject) => {
  const url = input instanceof Request ? input.url : String(input);
  const request = net.request({ url, redirect: 'manual', credentials: 'omit' });
  const signal = init?.signal;
  let settled = false;
  let ended = false;
  let body: ReadableStreamDefaultController<Uint8Array> | undefined;
  const cleanup = () => signal?.removeEventListener('abort', abort);
  const fail = (error: Error) => {
    cleanup();
    if (!settled) { settled = true; reject(error); }
    else if (!ended && body) { ended = true; body.error(error); }
  };
  const abort = () => {
    fail(new DOMException('Update download aborted', 'AbortError'));
    request.abort();
  };
  request.on('error', fail);
  request.on('redirect', (status, _method, location) => {
    if (settled) return;
    settled = true;
    cleanup();
    // No followRedirect call: the caller validates each destination before requesting it.
    resolve(new Response(null, { status, headers: { location } }));
    request.abort();
  });
  request.on('response', response => {
    if (settled) return;
    const headers = new Headers();
    for (const [key, values] of Object.entries(response.headers)) {
      for (const value of Array.isArray(values) ? values : [values]) headers.append(key, value);
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        body = controller;
        response.on('end', () => {
          cleanup();
          if (!ended) { ended = true; controller.close(); }
        });
        response.on('error', fail);
        response.on('aborted', () => fail(new Error('Update response aborted')));
        response.on('data', chunk => { if (!ended) controller.enqueue(new Uint8Array(chunk)); });
      },
      cancel() { ended = true; cleanup(); request.abort(); },
    });
    settled = true;
    resolve(new Response(stream, { status: response.statusCode, headers }));
  });
  if (signal?.aborted) abort();
  else {
    signal?.addEventListener('abort', abort, { once: true });
    request.end();
  }
});
