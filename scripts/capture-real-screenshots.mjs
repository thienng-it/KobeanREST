import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import path from 'path';

async function run() {
  console.log('🚀 Starting KobeanREST mock gRPC server & Vite app...');

  // 1. Start gRPC Mock HTTP server on port 3010
  const mockHttpServer = http.createServer((req, res) => {
    // Enable CORS for browser fetch
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'grpc-status, grpc-message, content-type, date');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/grpc-web+proto');
      res.setHeader('grpc-status', '0');
      res.setHeader('grpc-message', 'OK');

      const responsePayload = JSON.stringify({
        message: "Hello from KobeanREST mock gRPC Greeter!",
        timestamp: new Date().toISOString(),
        server: "KobeanREST-Mock/1.0"
      }, null, 2);

      res.writeHead(200);
      res.end(responsePayload);
    });
  });

  await new Promise(resolve => mockHttpServer.listen(3010, resolve));
  console.log('⚡ Mock gRPC server running at http://127.0.0.1:3010');

  // 2. Start Vite App and Docs servers
  const appServer = await createViteServer({
    configFile: path.resolve('vite.config.ts'),
    server: { port: 4173 }
  });
  await appServer.listen();

  const docsServer = await createViteServer({
    configFile: path.resolve('docs-site/vite.config.ts'),
    root: path.resolve('docs-site'),
    server: { port: 4174 }
  });
  await docsServer.listen();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 840 } });
  page.setDefaultTimeout(10000);

  const saveBoth = async (name) => {
    await page.screenshot({ path: `docs/images/${name}` });
    await page.screenshot({ path: `docs-site/public/images/${name}` });
    console.log(`📸 Successfully captured: ${name}`);
  };

  try {
    console.log('Navigating to KobeanREST web client...');
    await page.goto('http://localhost:4173');
    await page.waitForTimeout(2000);

    // 1. Open a request & capture Main UI
    console.log('Capturing Main UI...');
    const usersList = page.locator('text=Users List').first();
    if (await usersList.isVisible()) {
      await usersList.click();
      await page.waitForTimeout(800);
    }
    await saveBoth('main-ui.png');

    // 2. Params Tab
    console.log('Capturing Params Tab...');
    const paramsTab = page.locator('button:has-text("Params")').first();
    if (await paramsTab.isVisible()) {
      await paramsTab.click();
      await page.waitForTimeout(500);
      await saveBoth('params-tab.png');
    }

    // 3. Scripts Tab
    console.log('Capturing Scripts Tab...');
    const scriptsTab = page.locator('button:has-text("Scripts")').first();
    if (await scriptsTab.isVisible()) {
      await scriptsTab.click();
      await page.waitForTimeout(500);
      const postReq = page.locator('button:has-text("Post-request")').first();
      if (await postReq.isVisible()) {
        await postReq.click();
        await page.waitForTimeout(300);
      }
      await saveBoth('scripts-tab.png');
    }

    // 4. Setup Mock Server & Starter Templates
    console.log('Setting up and capturing Mock Server in API Tools...');
    const apiToolsBtn = page.locator('[aria-label="API Tools"]').first();
    if (await apiToolsBtn.isVisible()) {
      await apiToolsBtn.click();
      await page.waitForTimeout(800);

      // Click Mock Server tab in the left sidebar of API Tools modal
      const mockTab = page.locator('.settings-content button:has-text("Mock Server")').first();
      if (await mockTab.isVisible()) {
        await mockTab.click();
        await page.waitForTimeout(600);
      }

      // Click Templates button to open drawer
      const tplBtn = page.locator('button:has-text("Templates"), button:has-text("Browse Starter Templates")').first();
      if (await tplBtn.isVisible()) {
        await tplBtn.click();
        await page.waitForTimeout(600);

        // Click gRPC category filter or choose gRPC Greeter template
        const grpcFilterBtn = page.locator('button:has-text("gRPC & Proto")').first();
        if (await grpcFilterBtn.isVisible()) {
          await grpcFilterBtn.click();
          await page.waitForTimeout(400);
        }

        // Click Load Template on the gRPC Greeter preset
        const loadTplBtn = page.locator('button:has-text("Load Template")').first();
        if (await loadTplBtn.isVisible()) {
          await loadTplBtn.click();
          await page.waitForTimeout(600);
        }
      }

      // Start the mock server
      const startServerBtn = page.locator('button:has-text("Start Server")').first();
      if (await startServerBtn.isVisible()) {
        await startServerBtn.click();
        await page.waitForTimeout(600);
      }

      await saveBoth('mock-server.png');

      const closeApiTools = page.locator('button[aria-label="Close API Tools"]').first();
      if (await closeApiTools.isVisible()) {
        await closeApiTools.click();
        await page.waitForTimeout(600);
      }
    }

    // 5. gRPC Panel — Execute gRPC request to running Mock Server
    console.log('Executing real gRPC request and capturing gRPC Panel...');
    const methodBtn = page.locator('.method-selector-btn').first();
    if (await methodBtn.isVisible()) {
      await methodBtn.click();
      await page.waitForTimeout(400);
      const grpcOption = page.locator('.method-selector-option:has-text("GRPC")').first();
      if (await grpcOption.isVisible()) {
        await grpcOption.click();
        await page.waitForTimeout(800);

        // Fill URL with running mock gRPC server
        const urlInput = page.locator('input[placeholder*="localhost:50051"], input[placeholder*="grpc."]').first();
        if (await urlInput.isVisible()) {
          await urlInput.fill('http://127.0.0.1:3010/helloworld.Greeter/SayHello');
        }
        await page.waitForTimeout(500);

        // Click Invoke RPC to execute call to mock server
        const invokeBtn = page.locator('button:has-text("Invoke RPC")').first();
        if (await invokeBtn.isVisible()) {
          await invokeBtn.click();
          await page.waitForTimeout(1000); // wait for response packet & 0 OK status
        }

        await saveBoth('grpc-panel.png');
      }
    }

    // 6. WebSocket & Socket.IO Panel
    console.log('Capturing WebSocket Panel...');
    if (await methodBtn.isVisible()) {
      await methodBtn.click();
      await page.waitForTimeout(400);
      const wsOption = page.locator('.method-selector-option:has-text("SOCKET.IO")').first();
      if (await wsOption.isVisible()) {
        await wsOption.click();
        await page.waitForTimeout(800);
        await saveBoth('websocket-panel.png');
      }
    }

    // Switch back to GET
    if (await methodBtn.isVisible()) {
      await methodBtn.click();
      await page.waitForTimeout(400);
      const getOption = page.locator('.method-selector-option:has-text("GET")').first();
      if (await getOption.isVisible()) {
        await getOption.click();
        await page.waitForTimeout(500);
      }
    }

    // 7. Environment Editor
    console.log('Capturing Environment Editor...');
    const manageEnv = page.locator('button:has-text("Manage")').first();
    if (await manageEnv.isVisible()) {
      await manageEnv.click();
      await page.waitForTimeout(800);
      await saveBoth('environment-editor.png');
      const envClose = page.locator('.env-modal-close').first();
      if (await envClose.isVisible()) {
        await envClose.click();
        await page.waitForTimeout(600);
      }
    }

    // 8. History Viewer
    console.log('Capturing History Viewer...');
    const historyBtn = page.locator('[aria-label="Request History"]').first();
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      await page.waitForTimeout(800);
      await saveBoth('history-viewer.png');
      const histOverlay = page.locator('.modal-overlay[aria-label="Request history"]').first();
      if (await histOverlay.isVisible()) {
        await histOverlay.click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(600);
      }
    }

    // 9. QA Dashboard from Docs Portal
    console.log('Capturing QA Dashboard...');
    await page.goto('http://localhost:4174/#/qa');
    await page.waitForTimeout(2000);
    await saveBoth('qa-dashboard.png');

  } catch (err) {
    console.error('Screenshot capture failed:', err);
  } finally {
    await browser.close();
    await appServer.close();
    await docsServer.close();
    mockHttpServer.close();
    console.log('🎉 Done capturing all working real screenshots!');
  }
}

run();
