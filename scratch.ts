import { parsePostmanCollection } from './src/renderer/src/services/postman-import.ts';
const mock = {
  "info": { "name": "Test" },
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
console.log(JSON.stringify(parsePostmanCollection(JSON.stringify(mock)).requests[0].bodyForm, null, 2));
