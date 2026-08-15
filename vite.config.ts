import { defineConfig, type PluginOption } from 'vite';
import path from 'path';
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DEMOS = path.resolve(__dirname, 'demos');
const THUMBS = path.resolve(__dirname, 'public/thumbs');

type Demo = { name: string; title: string; description: string; featured: boolean; thumb: boolean };

const tag = (html: string, re: RegExp) => re.exec(html)?.[1]?.trim() ?? '';

/**
 * Every directory under demos/ holding a main.ts is a demo. Its own index.html
 * carries the text of its gallery card — <title> for the heading, and
 * <meta name="description"> for the blurb — so adding a demo adds a card with no
 * edit here or in the root index.html. <meta name="demo-featured"> floats one to
 * the front of the grid; the rest follow alphabetically.
 *
 * Re-read on every use rather than cached, so a demo added while the dev server
 * is running appears on the next reload.
 */
function listDemos(): Demo[] {
  return readdirSync(DEMOS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .filter((e) => existsSync(path.join(DEMOS, e.name, 'main.ts')))
    .map((e) => {
      const page = path.join(DEMOS, e.name, 'index.html');
      const html = existsSync(page) ? readFileSync(page, 'utf8') : '';
      return {
        name: e.name,
        title: tag(html, /<title>([^<]*)<\/title>/i) || e.name,
        description: tag(html, /<meta\s+name="description"\s+content="([^"]*)"/i),
        featured: /<meta\s+name="demo-featured"/i.test(html),
        // Written by the demo's own "Save Thumbnail" button (see screenshot.ts).
        // It lives under public/ so `npm run build` copies it without any asset
        // rewriting; the card falls back to text-only when there isn't one.
        thumb: existsSync(path.join(THUMBS, `${e.name}.jpg`)),
      };
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
}

const cards = (demos: Demo[]) =>
  demos
    .map(
      (d) => `    <a class="card${d.featured ? ' flagship' : ''}" href="/demos/${d.name}/">
${d.thumb ? `      <img class="shot" src="/thumbs/${d.name}.jpg" alt="" loading="lazy" />\n` : ''}      <h2>${d.title}</h2>
      <p>${d.description}</p>
    </a>`
    )
    .join('\n');

const demoPage = (d: Demo) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${d.title}</title>
  <style>
    body { margin: 0; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module" src="/demos/${d.name}/main.ts"></script>
</body>
</html>
`;

/**
 * Dev-only: receives a demo's gallery thumbnail from its "Save Thumbnail" button
 * and writes it to public/thumbs/<demo>.jpg. Composing a good shot needs a human
 * at the controls — framing, waiting for the path tracer to settle — so the
 * capture happens in the running demo and this just puts the bytes on disk.
 */
function thumbnailWriter(): PluginOption {
  return {
    name: 'demo-thumbnail-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-thumb', (req, res, next) => {
        if (req.method !== 'POST') return next();
        const demo = new URL(req.url ?? '/', 'http://localhost').searchParams.get('demo') ?? '';
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const ok = /^[\w-]+$/.test(demo) && existsSync(path.join(DEMOS, demo));
          if (!ok) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ ok: false, error: `unknown demo: ${demo}` }));
          }
          mkdirSync(THUMBS, { recursive: true });
          writeFileSync(path.join(THUMBS, `${demo}.jpg`), Buffer.concat(chunks));
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: `public/thumbs/${demo}.jpg` }));
        });
      });
    },
  };
}

/**
 * Fills in the gallery at the root index.html — in dev and in `npm run build`
 * alike, since transformIndexHtml runs for both — and, in dev only, serves a
 * page for any demo that has a main.ts but no index.html of its own, so a
 * freshly created demo directory is browsable before it has any markup.
 */
function demoGallery(): PluginOption {
  return {
    name: 'demo-gallery',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (path.resolve(ctx.filename) !== path.resolve(__dirname, 'index.html')) return html;
        const demos = listDemos();
        return html
          .replace('<!--demo-cards-->', cards(demos))
          .replace('<!--demo-count-->', `${demos.length} demos`);
      },
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '/').split('?')[0];
        const name = /^\/demos\/([^/]+)\/?$/.exec(url)?.[1];
        if (!name) return next();

        const demo = listDemos().find((d) => d.name === name);
        // A demo with its own index.html keeps it — let vite serve the file.
        if (!demo || existsSync(path.join(DEMOS, name, 'index.html'))) return next();
        if (!url.endsWith('/')) {
          res.statusCode = 302;
          res.setHeader('location', `${url}/`);
          return res.end();
        }
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html');
        res.end(await server.transformIndexHtml(url, demoPage(demo)));
      });
    },
  };
}

// The gallery plus one entry per demo. Demos are discovered rather than listed,
// so `npm run build` covers whatever demos/ currently holds. Only demos with
// their own index.html can be entries here — vite needs a real file; the
// synthesized dev pages above exist to get a new demo running before it has one.
const buildInput = Object.fromEntries([
  ['main', path.resolve(__dirname, 'index.html')],
  ...listDemos()
    .map((d) => [d.name, path.join(DEMOS, d.name, 'index.html')] as const)
    .filter(([, html]) => existsSync(html)),
]);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: buildInput,
    },
  },
  plugins: [demoGallery(), thumbnailWriter()],
});
