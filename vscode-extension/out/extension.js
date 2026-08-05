"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const KobeanWebviewProvider_1 = require("./KobeanWebviewProvider");
function activate(context) {
    console.log('KobeanREST VS Code Extension activated.');
    const sidebarProvider = new KobeanWebviewProvider_1.KobeanWebviewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(KobeanWebviewProvider_1.KobeanWebviewProvider.viewType, sidebarProvider));
    const openCommand = vscode.commands.registerCommand('kobeanrest.open', () => {
        KobeanWebviewProvider_1.KobeanWebviewProvider.createOrShowPanel(context.extensionUri);
    });
    const openSidebarCommand = vscode.commands.registerCommand('kobeanrest.openSidebar', () => {
        vscode.commands.executeCommand('workbench.view.extension.kobeanrest-sidebar-view-container');
    });
    context.subscriptions.push(openCommand, openSidebarCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map