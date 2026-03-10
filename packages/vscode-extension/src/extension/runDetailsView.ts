import * as vscode from 'vscode';

// Run Details Webview - shows run state, work summaries, key files, and process summary

function getNonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function htmlForRunDetails(webview: vscode.Webview, runId: string): string {
  const nonce = getNonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Run Details: ${runId}</title>
    <style>
      body { padding: 8px; margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
      .panel { margin-bottom: 16px; }
      .section-label { font-weight: bold; margin-bottom: 4px; }
      .empty { color: var(--vscode-descriptionForeground); font-style: italic; }
      .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.85em; }
      .overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 50; }
      .overlay.open { display: flex; align-items: center; justify-content: center; }
      .truncated { color: var(--vscode-descriptionForeground); font-size: 0.8em; }
    </style>
  </head>
  <body>
    <!-- Process Summary Section -->
    <div class="panel">
      <span id="processSummaryPill" class="pill">Process</span>
      <div id="processSummaryPreview" class="preview-container"></div>
    </div>

    <!-- Work Summaries Section -->
    <div class="panel">
      <div class="section-label">Work Summaries</div>
      <ul id="workList"></ul>
      <div id="workPreview" class="preview-container">
        <pre class="empty">No work summary output yet</pre>
      </div>
    </div>

    <!-- Prompts Section -->
    <div class="panel">
      <div class="section-label">Prompts</div>
      <ul id="promptList"></ul>
    </div>

    <!-- code/main.js Section -->
    <div class="panel">
      <div class="section-label">code/main.js</div>
      <pre id="mainJsPreviewPre" class="preview-pre"></pre>
    </div>

    <!-- Key Files Section -->
    <div class="panel">
      <div class="section-label">Key files</div>
      <input id="keyFilesFilter" type="text" placeholder="Filter files..." />
      <div id="keyFilesRevealRun" style="display:none;">
        <button class="secondary" onclick="vscode.postMessage({type:'revealRunFolder'})">Reveal Run Folder</button>
      </div>
      <div id="keyFilesCopyRun" style="display:none;">
        <button class="secondary" onclick="vscode.postMessage({type:'copyRunPath'})">Copy path</button>
      </div>
      <div id="keyFilesList"></div>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      // Persistent pinned files per run
      const pinnedIdsByRunId = {};

      let activeWorkPreviewFsPath = null;
      let latestRunStatus = 'running';

      function renderWorkList(items) {
        const list = document.getElementById('workList');
        if (!list) return;
        list.innerHTML = '';
        items.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item.label;
          li.dataset.fsPath = item.fsPath;
          li.addEventListener('click', () => {
            activeWorkPreviewFsPath = item.fsPath;
            vscode.postMessage({ type: 'loadTextFile', fsPath: item.fsPath });
          });
          list.appendChild(li);
        });
      }

      function renderKeyFiles(files) {
        const filterInput = document.getElementById('keyFilesFilter');
        const filterVal = filterInput ? filterInput.value.toLowerCase() : '';
        const container = document.getElementById('keyFilesList');
        if (!container) return;
        container.innerHTML = '';
        files
          .filter(f => !filterVal || f.relPath.toLowerCase().includes(filterVal))
          .forEach(f => {
            const div = document.createElement('div');
            div.className = 'key-file';
            div.innerHTML = '<span class="file-label">' + f.relPath + '</span>' +
              '<button onclick="copyContents(\'' + f.fsPath + '\')">Copy contents</button>' +
              '<button onclick="saveAs(\'' + f.fsPath + '\')">Save as...</button>';
            container.appendChild(div);
          });
      }

      function copyContents(fsPath) {
        vscode.postMessage({ type: 'copyFileContents', fsPath });
      }

      function saveAs(fsPath) {
        vscode.postMessage({ type: 'saveFileAs', fsPath });
      }

      document.getElementById('keyFilesFilter').addEventListener('input', () => {
        // Re-render with new filter
      });

      window.addEventListener('message', event => {
        const msg = event.data;

        if (msg.type === 'textFile') {
          if (msg.fsPath === activeWorkPreviewFsPath) {
            const preview = document.getElementById('workPreview');
            if (preview) {
              const content = msg.content || '';
              const isTruncated = msg.truncated;
              let html = '<pre>' + content + '</pre>';
              if (isTruncated) html += '<div class="truncated">(truncated)</div>';
              if (!content) {
                if (latestRunStatus === 'completed' || latestRunStatus === 'failed') {
                  html = '<pre class="empty">Run finished</pre>';
                } else {
                  html = '<pre class="empty">No work summary output yet</pre>';
                }
              }
              preview.innerHTML = html;
            }
          }
        }

        if (msg.type === 'snapshot') {
          latestRunStatus = msg.runStatus || 'running';
          if (msg.workSummaries) renderWorkList(msg.workSummaries);
          if (msg.keyFiles) renderKeyFiles(msg.keyFiles);
        }
      });
    </script>
  </body>
</html>`;
}

export function registerRunDetailsCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('babysitter.openRunDetails', (runId: string) => {
      const panel = vscode.window.createWebviewPanel(
        'babysitterRunDetails',
        `Run: ${runId}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      panel.webview.html = htmlForRunDetails(panel.webview, runId);
    })
  );
}
