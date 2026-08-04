import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';

async function run() {
  console.log('Starting KobeanREST vite servers...');
  const appServer = await createServer({
    configFile: path.resolve('vite.config.ts'),
    server: { port: 4173 }
  });
  await appServer.listen();

  const docsServer = await createServer({
    configFile: path.resolve('docs-site/vite.config.ts'),
    root: path.resolve('docs-site'),
    server: { port: 4174 }
  });
  await docsServer.listen();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(10000);

  try {
    console.log('Taking app screenshots...');
    await page.goto('http://localhost:4173');
    await page.waitForTimeout(2000);

    // Open a request
    await page.locator('text=Users List').first().click();
    await page.waitForTimeout(1000);

    // 1. Populate scripts
    console.log('Populating scripts...');
    await page.click('text=Scripts'); 
    await page.waitForTimeout(500);

    await page.click('text=Pre-request');
    await page.locator('.cm-content').first().click();
    await page.keyboard.type('// Generate dynamic timestamp\nkb.environment.set("timestamp", Date.now());\nconsole.log("Timestamp generated!");');
    await page.waitForTimeout(500);

    await page.click('text=Post-request');
    await page.locator('.cm-content').first().click();
    await page.keyboard.type('// Assert successful response\nif (kb.response.status === 200) {\n  console.log("Success!");\n  kb.test("Response is OK", () => {\n    kb.expect(kb.response.status).to.equal(200);\n  });\n}');
    await page.waitForTimeout(500);

    // Take Scripts Tab screenshot
    console.log('Taking Scripts Tab screenshot...');
    await page.screenshot({ path: 'docs/images/scripts-tab.png' });
    await page.screenshot({ path: 'docs-site/public/images/scripts-tab.png' });

    // Go back to Pre-request to show it in Main UI
    await page.click('text=Pre-request');
    await page.waitForTimeout(500);

    // 2. Main UI screenshot
    console.log('Taking Main UI screenshot...');
    await page.screenshot({ path: 'docs/images/main-ui.png' });
    await page.screenshot({ path: 'docs-site/public/images/main-ui.png' });

    // 3. Params Tab
    console.log('Taking Params Tab screenshot...');
    await page.click('text=Params');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/images/params-tab.png' });
    await page.screenshot({ path: 'docs-site/public/images/params-tab.png' });

    // 4. Environment Editor
    console.log('Taking Environment Editor screenshot...');
    await page.click('text=Manage');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/images/environment-editor.png' });
    await page.screenshot({ path: 'docs-site/public/images/environment-editor.png' });
    await page.click('.env-modal-close');
    await page.waitForTimeout(1000);

    // 5. History Modal
    console.log('Taking History Modal screenshot...');
    await page.locator('[aria-label="Request History"]').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/images/history-viewer.png' });
    await page.screenshot({ path: 'docs-site/public/images/history-viewer.png' });

    // 6. QA Dashboard
    console.log('Taking QA Dashboard screenshot...');
    await page.goto('http://localhost:4174/#/qa');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'docs/images/qa-dashboard.png' });
    await page.screenshot({ path: 'docs-site/public/images/qa-dashboard.png' });

  } catch (err) {
    console.error('Failed:', err);
  }

  await browser.close();
  await appServer.close();
  await docsServer.close();
  console.log('Done capturing all screenshots!');
}
run();
