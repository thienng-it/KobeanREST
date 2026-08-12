import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const EXT_DIR = path.join(import.meta.dirname, "..", "vscode-extension");

describe("VS Code Extension Contract", () => {
  // --- Package.json Structure ---
  describe("package.json", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(EXT_DIR, "package.json"), "utf-8"),
    );

    it("has required publisher field", () => {
      assert.ok(pkg.publisher, "publisher must be set");
      assert.equal(typeof pkg.publisher, "string");
    });

    it("has engine constraint", () => {
      assert.ok(pkg.engines?.vscode, "engines.vscode must be set");
    });

    it("has main entry point", () => {
      assert.equal(pkg.main, "./dist/extension.js");
    });

    it("declares activation events", () => {
      assert.ok(
        Array.isArray(pkg.activationEvents),
        "activationEvents must be an array",
      );
      assert.ok(pkg.activationEvents.length > 0);
    });

    it("declares commands", () => {
      const commands = pkg.contributes?.commands;
      assert.ok(Array.isArray(commands), "contributes.commands required");
      assert.ok(commands.length >= 10, "at least 10 commands expected");

      const ids = commands.map((c) => c.command);
      assert.ok(ids.includes("kobeanrest.openPanel"));
      assert.ok(ids.includes("kobeanrest.sendRequest"));
      assert.ok(ids.includes("kobeanrest.newRequest"));
      assert.ok(ids.includes("kobeanrest.importCollection"));
    });

    it("declares view containers", () => {
      const containers = pkg.contributes?.viewsContainers?.activitybar;
      assert.ok(
        Array.isArray(containers),
        "activitybar view container required",
      );
      assert.ok(
        containers.some((c) => c.id === "kobeanrest-sidebar"),
      );
    });

    it("declares views", () => {
      const views = pkg.contributes?.views?.["kobeanrest-sidebar"];
      assert.ok(Array.isArray(views), "sidebar views required");
      const viewIds = views.map((v) => v.id);
      assert.ok(viewIds.includes("kobeanrest-collections"));
      assert.ok(viewIds.includes("kobeanrest-history"));
    });

    it("declares language contribution for .http files", () => {
      const languages = pkg.contributes?.languages;
      assert.ok(Array.isArray(languages));
      const httpLang = languages.find((l) => l.id === "http");
      assert.ok(httpLang, ".http language must be declared");
      assert.ok(httpLang.extensions.includes(".http"));
      assert.ok(httpLang.extensions.includes(".rest"));
    });

    it("declares TextMate grammar", () => {
      const grammars = pkg.contributes?.grammars;
      assert.ok(Array.isArray(grammars));
      assert.ok(
        grammars.some((g) => g.scopeName === "source.http"),
      );
    });

    it("declares keybindings", () => {
      const bindings = pkg.contributes?.keybindings;
      assert.ok(Array.isArray(bindings));
      assert.ok(bindings.length >= 2);
    });

    it("declares configuration properties", () => {
      const props = pkg.contributes?.configuration?.properties;
      assert.ok(props, "configuration properties required");
      assert.ok(props["kobeanrest.defaultTimeout"]);
      assert.ok(props["kobeanrest.followRedirects"]);
      assert.ok(props["kobeanrest.maxHistoryEntries"]);
    });

    it("has no devDependency on cloud services", () => {
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      const cloudPkgs = [
        "firebase",
        "aws-sdk",
        "@azure",
        "googleapis",
      ];
      for (const cloud of cloudPkgs) {
        for (const dep of Object.keys(allDeps)) {
          assert.ok(
            !dep.includes(cloud),
            `Cloud dependency ${dep} violates local-first contract`,
          );
        }
      }
    });
  });

  // --- File Structure ---
  describe("file structure", () => {
    it("has TextMate grammar file", () => {
      assert.ok(
        fs.existsSync(
          path.join(EXT_DIR, "syntaxes", "http.tmLanguage.json"),
        ),
      );
    });

    it("has language configuration", () => {
      assert.ok(
        fs.existsSync(
          path.join(EXT_DIR, "language-configuration.json"),
        ),
      );
    });

    it("has esbuild config", () => {
      assert.ok(
        fs.existsSync(path.join(EXT_DIR, "esbuild.mjs")),
      );
    });

    it("has tsconfig", () => {
      assert.ok(
        fs.existsSync(path.join(EXT_DIR, "tsconfig.json")),
      );
    });

    it("has vscodeignore", () => {
      assert.ok(
        fs.existsSync(path.join(EXT_DIR, ".vscodeignore")),
      );
    });

    it("has extension entry point source", () => {
      assert.ok(
        fs.existsSync(
          path.join(EXT_DIR, "src", "extension.ts"),
        ),
      );
    });
  });

  // --- TextMate Grammar Validation ---
  describe("TextMate grammar", () => {
    const grammar = JSON.parse(
      fs.readFileSync(
        path.join(EXT_DIR, "syntaxes", "http.tmLanguage.json"),
        "utf-8",
      ),
    );

    it("has valid scopeName", () => {
      assert.equal(grammar.scopeName, "source.http");
    });

    it("declares patterns", () => {
      assert.ok(
        Array.isArray(grammar.patterns),
        "patterns must be an array",
      );
      assert.ok(grammar.patterns.length > 0);
    });

    it("has repository entries", () => {
      assert.ok(grammar.repository, "repository required");
      assert.ok(grammar.repository["request-line"]);
      assert.ok(grammar.repository["header"]);
      assert.ok(grammar.repository["variable-reference"]);
      assert.ok(grammar.repository["comment"]);
    });
  });

  // --- Security ---
  describe("security", () => {
    it("extension source has no hardcoded secrets", () => {
      const srcDir = path.join(EXT_DIR, "src");
      if (!fs.existsSync(srcDir)) return;

      const tsFiles = findFilesRecursive(srcDir, ".ts");
      const secretPatterns = [
        /['"]sk-[a-zA-Z0-9]{20,}['"]/,
        /['"]ghp_[a-zA-Z0-9]{36}['"]/,
        /['"]AKIA[A-Z0-9]{16}['"]/,
        /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
      ];

      for (const file of tsFiles) {
        const content = fs.readFileSync(file, "utf-8");
        for (const pattern of secretPatterns) {
          assert.ok(
            !pattern.test(content),
            `Potential hardcoded secret found in ${path.relative(EXT_DIR, file)}`,
          );
        }
      }
    });
  });
});

function findFilesRecursive(dir, ext) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findFilesRecursive(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}
