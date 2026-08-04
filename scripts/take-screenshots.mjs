import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';

async function run() {
  console.log('Starting KobeanREST vite server...');
  const appServer = await createServer({
    configFile: path.resolve('vite.config.ts'),
    server: { port: 4173 }
  });
  await appServer.listen();

  console.log('Starting Docs Site vite server...');
  const docsServer = await createServer({
    configFile: path.resolve('docs-site/vite.config.ts'),
    root: path.resolve('docs-site'),
    server: { port: 4174 }
  });
  await docsServer.listen();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('Taking app screenshot...');
  await page.goto('http://localhost:4173');
  await page.waitForTimeout(2000); // Wait for app to render
  await page.screenshot({ path: 'docs/images/main-ui.png' });
  await page.screenshot({ path: 'docs-site/public/images/main-ui.png' });

  console.log('Taking docs QA dashboard screenshot...');
  await page.goto('http://localhost:4174/#/qa');
  await page.waitForTimeout(2000); // Wait for docs to render
  await page.screenshot({ path: 'docs/images/qa-dashboard.png' });
  await page.screenshot({ path: 'docs-site/public/images/qa-dashboard.png' });

  await browser.close();
  await appServer.close();
  await docsServer.close();
  console.log('Done!');
}
run();
