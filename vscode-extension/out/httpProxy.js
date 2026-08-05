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
exports.executeHttpRequest = executeHttpRequest;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
async function executeHttpRequest(options) {
    const startTime = Date.now();
    const parsedUrl = new url_1.URL(options.url);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const reqHeaders = { ...options.headers };
    return new Promise((resolve, reject) => {
        const req = transport.request(parsedUrl, {
            method: options.method || 'GET',
            headers: reqHeaders,
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const duration = Date.now() - startTime;
                const resBody = Buffer.concat(chunks).toString('utf-8');
                const responseHeaders = {};
                for (const [key, val] of Object.entries(res.headers)) {
                    if (val !== undefined) {
                        responseHeaders[key] = Array.isArray(val) ? val.join(', ') : val;
                    }
                }
                resolve({
                    status: res.statusCode || 200,
                    statusText: res.statusMessage || 'OK',
                    headers: responseHeaders,
                    body: resBody,
                    timeMs: duration,
                });
            });
        });
        req.on('error', (err) => {
            reject(err);
        });
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}
//# sourceMappingURL=httpProxy.js.map