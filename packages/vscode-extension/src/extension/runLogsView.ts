import * as vscode from 'vscode';

// Run Logs Webview - streams stdout/stderr logs from a babysitter run

export function registerRunLogsCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('babysitter.openRunLogs', (runId: string) => {
      void openRunLogs(context, runId);
    })
  );
}

export async function openRunLogs(_context: vscode.ExtensionContext, runId: string): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'babysitterRunLogs',
    `Logs: ${runId}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = `<!doctype html><html><body><pre id="logs">Loading...</pre></body></html>`;
}
