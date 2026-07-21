import fs from "fs";
let content = fs.readFileSync("tests/editable-ui-contract.test.mjs", "utf8");

content = content.replace(/folderRequests\\\.map\\(request => \\(/g, 'folderRequests\\\\.map\\\\(\\\\(?request\\\\)? => \\\\(');
content = content.replace(/const visibleCollections = \\(workspace\\\.collections \\\?\\textquestiondown \\\[\\\]\\)\\\.filter/g, 'const visibleCollections = \\\\(workspace\\\\?.collections \\\\?\\\\? \\\\[\\\\]\\\\)\\\\.filter');
content = content.replace(/className="folder-title sidebar-tree-row collection-title"/g, 'className="folder-title sidebar-tree-row collection-title"');

fs.writeFileSync("tests/editable-ui-contract.test.mjs", content);
