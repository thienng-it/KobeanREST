Feature('KobeanREST Senior SDET E2E Automation Suite');

Scenario('1. Verify Workspace Load & Sidebar Collections', ({ I }) => {
  I.amOnPage('/');
  I.see('KobeanREST');
  I.see('Collections');
  I.see('JSONPlaceholder REST API');
  I.click('GET Users List');
  I.seeInField('.request-url-input input', '{{baseUrl}}/users');
});

Scenario('2. Verify URL and Query Params Bi-Directional Synchronization', ({ I }) => {
  I.amOnPage('/');
  I.click('GET Users List');
  I.click('Params');
  I.seeElement('.headers-table');
  I.seeInField('input[placeholder="Key"]', '_limit');
  I.seeInField('input[placeholder="Value"]', '5');
});

Scenario('3. Verify HTTP Request Execution & Response Panel', ({ I }) => {
  I.amOnPage('/');
  I.click('GET Users List');
  I.click('Send');
  I.waitForElement('.response-status', 10);
  I.see('200 OK');
});

Scenario('4. Verify Environment Selector & Variables Modal', ({ I }) => {
  I.amOnPage('/');
  I.see('Development');
  I.click('Manage');
  I.see('Environment Manager');
  I.see('baseUrl');
  I.see('https://jsonplaceholder.typicode.com');
  I.click('.modal-cancel');
});

Scenario('5. Verify Pre & Post Request Scripts Execution Interface', ({ I }) => {
  I.amOnPage('/');
  I.click('GET Users List');
  I.click('Scripts');
  I.see('Pre-request Script');
  I.see('Post-request Script');
});
