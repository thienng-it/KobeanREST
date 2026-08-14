import { parsePostmanCollection } from './src/renderer/src/services/postman-import';
import { parseUniversalImport } from './src/renderer/src/services/import-parser';

const collectionJson = {
  "info": {
    "name": "Test Collection",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Test Request",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "hasCoverSheet",
              "value": "false",
              "type": "text"
            },
            {
              "key": "subject",
              "value": "",
              "type": "text"
            },
            {
              "key": "message",
              "value": "",
              "type": "text"
            },
            {
              "key": "sender",
              "value": "{{eFaxSubId}}\n",
              "type": "text"
            },
            {
              "key": "recipient",
              "value": "10191001",
              "type": "text"
            },
            {
              "key": "files[]",
              "type": "file",
              "src": "/etc/newman/GOUCAPI/Files/sample_eFax.pdf"
            }
          ]
        },
        "url": {
          "raw": "https://example.com/api",
          "protocol": "https",
          "host": [
            "example",
            "com"
          ],
          "path": [
            "api"
          ]
        }
      }
    }
  ]
};

const str = JSON.stringify(collectionJson);

console.log("=== parsePostmanCollection ===");
const p1 = parsePostmanCollection(str);
console.log(JSON.stringify(p1.requests[0].bodyForm, null, 2));

console.log("=== parseUniversalImport ===");
const p2 = parseUniversalImport(str);
console.log(JSON.stringify(p2.exportData.requests[0].body_form, null, 2));

