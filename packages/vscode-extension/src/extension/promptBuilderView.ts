import * as vscode from 'vscode';

// Prompt Builder Webview Provider for Babysitter
// Provides a rich UI for composing prompts and dispatching babysitter runs.

function getNonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function htmlForWebview(webview: vscode.Webview, title: string): string {
  const nonce = getNonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { padding: 0; margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
      textarea { width: 100%; box-sizing: border-box; }
      .overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 100; }
      .overlay.open { display: flex; align-items: center; justify-content: center; }
      .overlay-content { background: var(--vscode-editor-background); padding: 16px; max-width: 80%; max-height: 80%; overflow: auto; }
    </style>
  </head>
  <body>
    <div id="app">
      <textarea id="request" rows="4" placeholder="Describe your request..."></textarea>
      <div id="paramsContainer"></div>
      <textarea id="output" rows="8" readonly placeholder="Composed prompt will appear here..."></textarea>
      <div class="actions">
        <button id="preview" class="secondary">Preview</button>
        <button id="insert" class="secondary">Insert</button>
        <button id="copy" class="secondary">Copy</button>
        <button id="dispatch" class="primary">Dispatch Run</button>
      </div>
    </div>
    <div id="previewOverlay" class="overlay" role="dialog" aria-modal="true" aria-label="Prompt preview">
      <div class="overlay-content">
        <div class="overlay-header">
          <h3>Prompt preview</h3>
          <button id="previewClose" class="secondary" aria-label="Close preview">Close</button>
        </div>
        <pre id="previewText"></pre>
      </div>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const els = {
        request: document.getElementById('request'),
        output: document.getElementById('output'),
        preview: document.getElementById('preview'),
        insert: document.getElementById('insert'),
        copy: document.getElementById('copy'),
        dispatch: document.getElementById('dispatch'),
        previewOverlay: document.getElementById('previewOverlay'),
        previewClose: document.getElementById('previewClose'),
        previewText: document.getElementById('previewText'),
      };

      const state = { attachments: [], lastPrompt: '' };

      function updatePreviewButton() {
        const hasPrompt = (els.output.value || '').trim().length > 0;
        els.preview.disabled = !hasPrompt;
      }

      function openPreview(text) {
        els.previewText.textContent = text || '';
        els.previewOverlay.classList.add('open');
        els.previewClose.focus();
      }

      function closePreview() {
        els.previewOverlay.classList.remove('open');
      }

      function scheduleGenerate() {
        vscode.postMessage({ type: 'generate', request: els.request.value, attachments: state.attachments.slice() });
      }

      els.request.addEventListener('input', () => {
        scheduleGenerate();
      });

      document.querySelectorAll('.param-input').forEach(input => {
        input.addEventListener('input', () => {
          scheduleGenerate();
        });
      });

      els.preview.addEventListener('click', () => {
        vscode.postMessage({ type: 'previewPrompt', text: els.output.value || '' });
      });

      els.previewClose.addEventListener('click', () => closePreview());

      els.previewOverlay.addEventListener('click', (e) => {
        if (e.target === els.previewOverlay) closePreview();
      });

      els.insert.addEventListener('click', () => {
        vscode.postMessage({ type: 'insert', text: els.output.value || '' });
      });

      els.copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(els.output.value || '');
      });

      els.dispatch.addEventListener('click', () => {
        vscode.postMessage({ type: 'dispatch', text: els.output.value || '' });
      });

      els.output.addEventListener('input', () => {
        updatePreviewButton();
      });

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'prompt') {
          state.lastPrompt = msg.text || '';
          els.output.value = state.lastPrompt;
          updatePreviewButton();
        }
        if (msg.type === 'promptPreview') {
          openPreview(msg.text);
        }
      });

      scheduleGenerate();
    </script>
  </body>
</html>`;
}

export function registerPromptBuilderCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('babysitter.openPromptBuilder', () => {
      void openPromptBuilder(context);
    })
  );
}

export async function openPromptBuilder(_context: vscode.ExtensionContext): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'babysitterPromptBuilder',
    'Babysitter Prompt Builder',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );
  panel.webview.html = htmlForWebview(panel.webview, 'Babysitter Prompt Builder');
}
