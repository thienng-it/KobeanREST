Feature('KobeanREST Senior SDET E2E Automation Suite');

Scenario('1. Verify Workspace Load & Sidebar Collections', ({ I }) => {
  I.amOnPage('/');
  I.see('LOCAL WORKSPACE');
  I.see('JSONPlaceholder REST API');
  I.click('GET Users List');
  I.seeInField('input[aria-label="Request URL"]', '{{baseUrl}}/users');
  I.saveScreenshot('main-ui.png');
});

Scenario('2. Verify URL and Query Params Bi-Directional Synchronization', ({ I }) => {
  I.amOnPage('/');
  I.click('GET Users List');
  I.seeInField('input[placeholder="Parameter key"]', '_limit');
});

Scenario('3. Verify HTTP Request Execution & Response Panel', ({ I }) => {
  I.amOnPage('/');
  I.click('GET Users List');
  I.click('Send');
  I.waitForElement('.response-stats', 10);
  I.see('200');
});

Scenario('4. Verify Environment Selector & Variables Modal', ({ I }) => {
  I.amOnPage('/');
  I.see('Development');
  I.click('Manage');
  I.see('Environments');
  I.see('baseUrl');
  I.see('https://jsonplaceholder.typicode.com');
  I.click('.env-modal-close');
});

Scenario('5. Verify Pre & Post Request Scripts Execution Interface', ({ I }) => {
  I.amOnPage('/');
  I.click('GET Users List');
  I.click('scripts');
  I.see('Pre-request');
  I.see('Post-request');
});
