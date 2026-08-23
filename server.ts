import express from 'express';
import { createServer as createViteServer } from 'vite';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './src/server/router';
import { initDb } from './src/db';
import path from 'path';

const ONE_DAY_SECONDS = 60 * 60 * 24;
const ONE_YEAR_SECONDS = ONE_DAY_SECONDS * 365;

async function startServer() {
  await initDb();
  
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const isProduction = process.env.NODE_ENV === 'production';

  // tRPC middleware
  app.use(
    '/api/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: () => ({}),
    })
  );

  app.use(
    express.static(path.join(process.cwd(), 'public'), {
      maxAge: '365d',
      setHeaders: (res, filePath) => {
        if (!isProduction) {
          // Development assets change frequently. A year-long immutable cache
          // can preserve a stale or interrupted media response across restarts.
          res.setHeader('Cache-Control', 'no-store');
          if (/\.(mp4|webm|mp3|png|jpe?g|webp|svg|ttf|woff2?)$/i.test(filePath)) {
            res.setHeader('Accept-Ranges', 'bytes');
          }
          return;
        }

        if (filePath.endsWith('.html') || filePath.endsWith('.json')) {
          res.setHeader('Cache-Control', 'no-cache');
          return;
        }

        if (/\.(mp4|webm|mp3|png|jpe?g|webp|svg|ttf|woff2?)$/i.test(filePath)) {
          res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
          res.setHeader('Accept-Ranges', 'bytes');
        }
      },
    })
  );

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.join(process.cwd(), 'dist'), {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
            return;
          }

          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
          } else {
            res.setHeader('Cache-Control', `public, max-age=${ONE_DAY_SECONDS}`);
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  // Bind to the platform's dual-stack wildcard so localhost can use ::1 or
  // 127.0.0.1 without waiting for an IPv6 connection to fail first.
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
