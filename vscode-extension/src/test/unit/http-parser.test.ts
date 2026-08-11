import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parseHttpFile, findRequestAtLine } from "../../language/http-file-parser.ts";

describe("HttpFileParser", () => {
  it("parses a simple GET request", () => {
    const content = `GET https://api.example.com/users`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[0].url, "https://api.example.com/users");
    assert.equal(requests[0].headers.length, 0);
    assert.equal(requests[0].body, undefined);
  });

  it("parses request with headers", () => {
    const content = `POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer {{token}}

{"name": "test"}`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].headers.length, 2);
    assert.equal(requests[0].headers[0].key, "Content-Type");
    assert.equal(requests[0].headers[0].value, "application/json");
    assert.equal(requests[0].headers[1].key, "Authorization");
    assert.equal(requests[0].headers[1].value, "Bearer {{token}}");
    assert.equal(requests[0].body, '{"name": "test"}');
  });

  it("parses multiple requests separated by ###", () => {
    const content = `GET https://api.example.com/users

###

POST https://api.example.com/users
Content-Type: application/json

{"name": "new user"}

###

DELETE https://api.example.com/users/1`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 3);
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].method, "POST");
    assert.equal(requests[2].method, "DELETE");
  });

  it("parses @name directives", () => {
    const content = `# @name getUsers
GET https://api.example.com/users`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].name, "getUsers");
  });

  it("parses file-level variables", () => {
    const content = `@baseUrl = https://api.example.com
@token = abc123

GET {{baseUrl}}/users
Authorization: Bearer {{token}}`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].fileVariables.get("baseUrl"), "https://api.example.com");
    assert.equal(requests[0].fileVariables.get("token"), "abc123");
  });

  it("ignores comments", () => {
    const content = `# This is a comment
// Another comment
GET https://api.example.com/users`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "GET");
  });

  it("handles POST with multi-line JSON body", () => {
    const content = `POST https://api.example.com/users
Content-Type: application/json

{
  "name": "test",
  "email": "test@example.com",
  "role": "admin"
}`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].body?.includes('"name": "test"'));
    assert.ok(requests[0].body?.includes('"role": "admin"'));
  });

  it("handles empty file", () => {
    const requests = parseHttpFile("");
    assert.equal(requests.length, 0);
  });

  it("handles file with only comments", () => {
    const content = `# Just a comment
// Another comment`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 0);
  });

  it("correctly tracks line numbers", () => {
    const content = `GET https://api.example.com/first

###

POST https://api.example.com/second
Content-Type: application/json

{"test": true}`;
    const requests = parseHttpFile(content);
    assert.equal(requests[0].startLine, 0);
    assert.equal(requests[1].startLine, 4);
  });

  it("findRequestAtLine returns correct request", () => {
    const content = `GET https://api.example.com/first

###

POST https://api.example.com/second`;
    const requests = parseHttpFile(content);
    const found = findRequestAtLine(requests, 0);
    assert.equal(found?.method, "GET");
    const found2 = findRequestAtLine(requests, 4);
    assert.equal(found2?.method, "POST");
  });

  it("handles HTTP version in request line", () => {
    const content = `GET https://api.example.com/users HTTP/1.1`;
    const requests = parseHttpFile(content);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.example.com/users");
  });

  it("parses all standard HTTP methods", () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    for (const method of methods) {
      const content = `${method} https://api.example.com/test`;
      const requests = parseHttpFile(content);
      assert.equal(requests.length, 1, `Failed for method ${method}`);
      assert.equal(requests[0].method, method);
    }
  });

  it("trims trailing empty lines from body", () => {
    const content = `POST https://api.example.com/test
Content-Type: application/json

{"test": true}


`;
    const requests = parseHttpFile(content);
    assert.equal(requests[0].body, '{"test": true}');
  });
});
