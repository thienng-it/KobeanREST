import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import path from 'path';
import fs from 'fs';

async function run() {
  console.log('🚀 Starting KobeanREST mock gRPC server & Vite app...');

  // Ensure output directories exist
  const outputDirs = ['docs/images', 'docs-site/public/images', 'screenshots'];
  for (const dir of outputDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. Start gRPC Mock HTTP server on port 3010
  const mockHttpServer = http.createServer((req, res) => {
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
  page.setDefaultTimeout(12000);

  const saveAll = async (name) => {
    for (const dir of outputDirs) {
      await page.screenshot({ path: path.join(dir, name) });
    }
    console.log(`📸 Successfully captured: ${name}`);
  };

  try {
    console.log('Navigating to KobeanREST web client...');
    await page.goto('http://localhost:4173');
    await page.waitForTimeout(2000);

    // 1. Open a request & capture Main UI
    console.log('1. Capturing Main UI...');
    const requestItem = page.locator('.sidebar-item-request, .sidebar-tree-node, [role="treeitem"]').first();
    if (await requestItem.isVisible()) {
      await requestItem.click();
      await page.waitForTimeout(600);
    }
    await saveAll('main-ui.png');

    // 2. Params Tab
    console.log('2. Capturing Params Tab...');
    const paramsTab = page.locator('button:has-text("Params")').first();
    if (await paramsTab.isVisible()) {
      await paramsTab.click();
      await page.waitForTimeout(500);
      await saveAll('params-tab.png');
    }

    // 3. Scripts Tab
    console.log('3. Capturing Scripts Tab...');
    const scriptsTab = page.locator('button:has-text("Scripts")').first();
    if (await scriptsTab.isVisible()) {
      await scriptsTab.click();
      await page.waitForTimeout(500);
      const postReq = page.locator('button:has-text("Post-request")').first();
      if (await postReq.isVisible()) {
        await postReq.click();
        await page.waitForTimeout(300);
      }
      await saveAll('scripts-tab.png');
    }

    // 4. AI Chat Sidebar
    console.log('4. Capturing AI Chat Sidebar...');
    const aiToggleBtn = page.locator('button[title*="AI Chat"], button:has-text("AI Chat")').first();
    if (await aiToggleBtn.isVisible()) {
      await aiToggleBtn.click();
      await page.waitForTimeout(800);
      await saveAll('ai-chat-sidebar.png');
      // Close AI Chat to restore full workspace layout
      await aiToggleBtn.click();
      await page.waitForTimeout(400);
    }

    // 5. Workspaces Hub & Universal Import
    console.log('5. Capturing Workspaces Hub...');
    const workspacesHubBtn = page.locator('button[aria-label="Workspaces Hub"], button[title="Open Workspaces Hub"]').first();
    if (await workspacesHubBtn.isVisible()) {
      await workspacesHubBtn.click();
      await page.waitForTimeout(1000);
      await saveAll('workspaces-hub.png');

      // Capture Universal Import modal opened from Workspaces Hub
      console.log('5b. Capturing Universal Import Modal...');
      const importFromHubBtn = page.locator('.workspaces-manager-view button:has-text("Import")').first();
      if (await importFromHubBtn.isVisible()) {
        await importFromHubBtn.click();
        await page.waitForTimeout(600);
        await saveAll('universal-import.png');

        const closeImportBtn = page.locator('button:has-text("Cancel"), button[aria-label="Close"], .modal-close-btn').first();
        if (await closeImportBtn.isVisible()) {
          await closeImportBtn.click();
          await page.waitForTimeout(400);
        }
      }

      const backBtn = page.locator('button:has-text("Back to Workspace")').first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(800);
      }
    }

    // 6. Collections Hub
    console.log('6. Capturing Collections Hub...');
    const collectionsHubBtn = page.locator('button[aria-label="View all collections"], button[title="View all collections"], button[title="Click to view All Collections"]').first();
    if (await collectionsHubBtn.isVisible()) {
      await collectionsHubBtn.click();
      await page.waitForTimeout(800);
      await saveAll('collections-hub.png');

      // Close the collections hub tab
      const closeColHubTab = page.locator('.tab:has-text("Collections Hub") .tab-close-btn, .tab:has-text("Collections") .tab-close-btn').first();
      if (await closeColHubTab.isVisible()) {
        await closeColHubTab.click();
        await page.waitForTimeout(500);
      }
    }

    // 7. Collection Passcode Lock Modal
    try {
      console.log('7. Capturing Collection Security / Passcode Lock Modal...');
      const lockBtn = page.locator('button[title*="lock"], button[title*="Lock"], button[aria-label*="lock"], button[aria-label*="Lock"]').first();
      if (await lockBtn.isVisible()) {
        await lockBtn.click({ force: true });
        await page.waitForTimeout(600);
        await saveAll('collection-lock.png');

        const cancelLockBtn = page.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
        if (await cancelLockBtn.isVisible()) {
          await cancelLockBtn.click({ force: true });
          await page.waitForTimeout(400);
        }
      }
    } catch (e) {
      console.warn('Step 7 skipped or failed:', e?.message);
    }

    // 8. Plugins Catalog
    try {
      console.log('8. Capturing Plugins Catalog...');
      const pluginsBtn = page.locator('button[aria-label="Plugin Manager"], button[title="Plugins"]').first();
      if (await pluginsBtn.isVisible()) {
        await pluginsBtn.click({ force: true });
        await page.waitForTimeout(800);
        await saveAll('plugins-catalog.png');

        const closePluginsBtn = page.locator('.settings-close, button[aria-label="Close"], .modal-close-btn').first();
        if (await closePluginsBtn.isVisible()) {
          await closePluginsBtn.click({ force: true });
          await page.waitForTimeout(400);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
        }
      }
    } catch (e) {
      console.warn('Step 8 skipped or failed:', e?.message);
    }

    // 9. Collection Runner
    try {
      console.log('9. Capturing Collection Runner...');
      const colHeader = page.locator('.sidebar-item-collection, .sidebar-collection-header, .collection-title').first();
      if (await colHeader.isVisible()) {
        await colHeader.click({ button: 'right', force: true });
        await page.waitForTimeout(400);
        const runCollectionOption = page.locator('.context-menu-item:has-text("Run Collection"), button:has-text("Run Collection")').first();
        if (await runCollectionOption.isVisible()) {
          await runCollectionOption.click({ force: true });
          await page.waitForTimeout(800);
          await saveAll('collection-runner.png');

          const closeRunnerTab = page.locator('.tab:has-text("Run:") .tab-close-btn, .tab:has-text("Runner") .tab-close-btn').first();
          if (await closeRunnerTab.isVisible()) {
            await closeRunnerTab.click({ force: true });
            await page.waitForTimeout(400);
          }
        }
      }
    } catch (e) {
      console.warn('Step 9 skipped or failed:', e?.message);
    }

    // 10. Setup Mock Server & Starter Templates in API Tools
    try {
      console.log('10. Setting up and capturing Mock Server in API Tools...');
      const apiToolsBtn = page.locator('[aria-label="API Tools"]').first();
      if (await apiToolsBtn.isVisible()) {
        await apiToolsBtn.click({ force: true });
        await page.waitForTimeout(800);

        // Click Mock Server tab in the left sidebar of API Tools modal
        const mockTab = page.locator('.settings-content button:has-text("Mock Server"), button:has-text("Mock Server")').first();
        if (await mockTab.isVisible()) {
          await mockTab.click({ force: true });
          await page.waitForTimeout(600);
        }

        // Click Templates button to open drawer
        const tplBtn = page.locator('button:has-text("Templates"), button:has-text("Browse Starter Templates")').first();
        if (await tplBtn.isVisible()) {
          await tplBtn.click({ force: true });
          await page.waitForTimeout(600);

          // Click gRPC category filter or choose gRPC Greeter template
          const grpcFilterBtn = page.locator('button:has-text("gRPC & Proto")').first();
          if (await grpcFilterBtn.isVisible()) {
            await grpcFilterBtn.click({ force: true });
            await page.waitForTimeout(400);
          }

          // Click Load Template on the gRPC Greeter preset
          const loadTplBtn = page.locator('button:has-text("Load Template")').first();
          if (await loadTplBtn.isVisible()) {
            await loadTplBtn.click({ force: true });
            await page.waitForTimeout(600);
          }
        }

        // Start the mock server
        const startServerBtn = page.locator('button:has-text("Start Server")').first();
        if (await startServerBtn.isVisible()) {
          await startServerBtn.click({ force: true });
          await page.waitForTimeout(600);
        }

        await saveAll('mock-server.png');

        const closeApiTools = page.locator('.settings-close, button[aria-label="Close API Tools"], button[aria-label="Close"]').first();
        if (await closeApiTools.isVisible()) {
          await closeApiTools.click({ force: true });
          await page.waitForTimeout(600);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
        }
      }
    } catch (e) {
      console.warn('Step 10 skipped or failed:', e?.message);
    }

    // 11. gRPC Panel — Execute gRPC request to running Mock Server
    try {
      console.log('11. Executing real gRPC request and capturing gRPC Panel...');
      const reqItem = page.locator('.sidebar-item-request, .sidebar-tree-node, [role="treeitem"]').first();
      if (await reqItem.isVisible()) {
        await reqItem.click({ force: true });
        await page.waitForTimeout(600);
      }

      const methodBtn = page.locator('.method-selector-btn').first();
      if (await methodBtn.isVisible()) {
        await methodBtn.click({ force: true });
        await page.waitForTimeout(400);
        const grpcOption = page.locator('.method-selector-option:has-text("GRPC")').first();
        if (await grpcOption.isVisible()) {
          await grpcOption.click({ force: true });
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
            await invokeBtn.click({ force: true });
            await page.waitForTimeout(1000); // wait for response packet & 0 OK status
          }

          await saveAll('grpc-panel.png');
        }
      }
    } catch (e) {
      console.warn('Step 11 skipped or failed:', e?.message);
    }

    // 12. WebSocket & Socket.IO Panel
    try {
      console.log('12. Capturing WebSocket Panel...');
      const methodBtn = page.locator('.method-selector-btn').first();
      if (await methodBtn.isVisible()) {
        await methodBtn.click({ force: true });
        await page.waitForTimeout(400);
        const wsOption = page.locator('.method-selector-option:has-text("SOCKET.IO")').first();
        if (await wsOption.isVisible()) {
          await wsOption.click({ force: true });
          await page.waitForTimeout(800);
          await saveAll('websocket-panel.png');
        }

        // Switch back to GET
        await methodBtn.click({ force: true });
        await page.waitForTimeout(400);
        const getOption = page.locator('.method-selector-option:has-text("GET")').first();
        if (await getOption.isVisible()) {
          await getOption.click({ force: true });
          await page.waitForTimeout(500);
        }
      }
    } catch (e) {
      console.warn('Step 12 skipped or failed:', e?.message);
    }

    // 13. Environment Editor
    try {
      console.log('13. Capturing Environment Editor...');
      const manageEnv = page.locator('button:has-text("Manage")').first();
      if (await manageEnv.isVisible()) {
        await manageEnv.click({ force: true });
        await page.waitForTimeout(800);
        await saveAll('environment-editor.png');
        const envClose = page.locator('.env-modal-close, .settings-close').first();
        if (await envClose.isVisible()) {
          await envClose.click({ force: true });
          await page.waitForTimeout(600);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
        }
      }
    } catch (e) {
      console.warn('Step 13 skipped or failed:', e?.message);
    }

    // 14. History Viewer
    try {
      console.log('14. Capturing History Viewer...');
      const historyBtn = page.locator('[aria-label="Request History"]').first();
      if (await historyBtn.isVisible()) {
        await historyBtn.click({ force: true });
        await page.waitForTimeout(800);
        await saveAll('history-viewer.png');
        const histOverlay = page.locator('.modal-overlay[aria-label="Request history"], .modal-overlay').first();
        if (await histOverlay.isVisible()) {
          await histOverlay.click({ position: { x: 10, y: 10 }, force: true });
          await page.waitForTimeout(600);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
        }
      }
    } catch (e) {
      console.warn('Step 14 skipped or failed:', e?.message);
    }

    // 15. QA Dashboard from Docs Portal
    try {
      console.log('15. Capturing QA Dashboard...');
      await page.goto('http://localhost:4174/#/qa');
      await page.waitForTimeout(2000);
      await saveAll('qa-dashboard.png');
    } catch (e) {
      console.warn('Step 15 skipped or failed:', e?.message);
    }

  } catch (err) {
    console.error('Screenshot capture encountered an error:', err);
  } finally {
    await browser.close();
    await appServer.close();
    await docsServer.close();
    mockHttpServer.close();
    console.log('🎉 Done capturing all working real screenshots!');
  }
}

run();
