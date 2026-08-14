import { getInstalledPlugins } from './plugin-registry';
import { runKbScript } from './script-runtime';
import type { KbScriptContext, ScriptConsole } from './script-runtime';

/**
 * Run all enabled installed plugins' pre-request scripts.
 * Called after the user's own pre-request script.
 */
export async function runPluginPreRequestScripts(
  ctx: KbScriptContext,
  console: ScriptConsole,
): Promise<void> {
  const plugins = getInstalledPlugins().filter(p => p.enabled && p.preRequestScript);
  for (const plugin of plugins) {
    try {
      await runKbScript(plugin.preRequestScript!, ctx, console);
    } catch (e: any) {
      console.error(`[Plugin:${plugin.id}] Pre-request error: ${e?.message ?? e}`);
    }
  }
}

/**
 * Run all enabled installed plugins' post-response scripts.
 * Called after the user's own post-response script.
 */
export async function runPluginPostResponseScripts(
  ctx: KbScriptContext,
  console: ScriptConsole,
): Promise<void> {
  const plugins = getInstalledPlugins().filter(p => p.enabled && p.postResponseScript);
  for (const plugin of plugins) {
    try {
      await runKbScript(plugin.postResponseScript!, ctx, console);
    } catch (e: any) {
      console.error(`[Plugin:${plugin.id}] Post-response error: ${e?.message ?? e}`);
    }
  }
}
