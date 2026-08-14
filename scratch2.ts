import { parseUniversalImport } from './src/renderer/src/services/import-parser.ts';
const mock = {
  "info": { "name": "Test", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  "item": [{
    "name": "Test Request",
    "request": {
      "method": "POST",
      "url": "https://test.com",
      "body": {
        "mode": "formdata",
        "formdata": [
          { "key": "hasCoverSheet", "value": "false", "type": "text" },
          { "key": "subject", "value": "", "type": "text" },
          { "key": "message", "value": "", "type": "text" },
          { "key": "sender", "value": "{{eFaxSubId}}\n", "type": "text" },
          { "key": "recipient", "value": "10191001", "type": "text" },
          { "key": "files[]", "type": "file", "uuid": "a1927fcf-4a47-4ab9-bf2f-e294a89b0c8a", "src": "/etc/newman/GOUCAPI/Files/sample_eFax.pdf" }
        ]
      }
    }
  }]
};
const res = parseUniversalImport(JSON.stringify(mock));
console.log(JSON.stringify(res.exportData.requests[0], null, 2));
