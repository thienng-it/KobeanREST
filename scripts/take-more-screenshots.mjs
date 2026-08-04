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

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(5000);

  console.log('Taking feature screenshots...');
  await page.goto('http://localhost:4173');
  await page.waitForTimeout(2000); 

  try {
    // 1. Environment Editor
    console.log('Taking Environment Editor screenshot...');
    await page.click('text=Manage');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/images/environment-editor.png' });
    await page.screenshot({ path: 'docs-site/public/images/environment-editor.png' });
    await page.click('.env-modal-close');
    await page.waitForTimeout(1000);

    // 2. Select a request
    console.log('Opening request...');
    await page.locator('text=Users List').first().click();
    await page.waitForTimeout(1000);

    // 3. Scripts Tab
    console.log('Taking Scripts Tab screenshot...');
    await page.click('text=Scripts'); 
    await page.waitForTimeout(500);

    // Type into Pre-request Script
    console.log('Typing Pre-request script...');
    await page.click('text=Pre-request');
    await page.locator('.cm-content').first().click();
    await page.keyboard.type('// Generate dynamic timestamp\nkb.environment.set("timestamp", Date.now());\nconsole.log("Timestamp generated!");');
    
    await page.waitForTimeout(500);

    // Click into Post-request Script
    console.log('Typing Post-request script...');
    await page.click('text=Post-request');
    await page.locator('.cm-content').first().click();
    await page.keyboard.type('// Assert successful response\nif (kb.response.status === 200) {\n  console.log("Success!");\n  kb.test("Response is OK", () => {\n    kb.expect(kb.response.status).to.equal(200);\n  });\n}');
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/images/scripts-tab.png' });
    await page.screenshot({ path: 'docs-site/public/images/scripts-tab.png' });

    // 4. Params Tab
    console.log('Taking Params Tab screenshot...');
    await page.click('text=Params');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/images/params-tab.png' });
    await page.screenshot({ path: 'docs-site/public/images/params-tab.png' });

    // 5. History Modal
    console.log('Taking History Modal screenshot...');
    // In Sidebar it is: aria-label="Request History"
    await page.locator('[aria-label="Request History"]').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/images/history-viewer.png' });
    await page.screenshot({ path: 'docs-site/public/images/history-viewer.png' });

  } catch (err) {
    console.error('Failed:', err);
    await page.screenshot({ path: 'error-screenshot.png' });
  }

  await browser.close();
  await appServer.close();
  console.log('Done!');
}
run();
