import * as vscode from 'vscode';
import { BabysitterSDK } from '../core/sdk';
import { RunsManager } from '../core/runsManager';
import { BabysitterBackgroundAgent } from './backgroundAgent';

/**
 * GitHub Copilot Chat Participant for Babysitter
 * 
 * Enables natural language orchestration via @babysitter in Copilot Chat
 */
export class BabysitterCopilotParticipant {
  private participant: vscode.ChatParticipant | undefined;
  private sdk: BabysitterSDK;
  private runsManager: RunsManager;
  private readonly agents: Map<string, BabysitterBackgroundAgent> = new Map();
  private readonly extensionContext: vscode.ExtensionContext;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(
    context: vscode.ExtensionContext,
    sdk: BabysitterSDK,
    runsManager: RunsManager
  ) {
    this.extensionContext = context;
    this.sdk = sdk;
    this.runsManager = runsManager;
    // Create a dedicated output channel for background agent activity
    this.outputChannel = vscode.window.createOutputChannel('Babysitter Agent');
    context.subscriptions.push(this.outputChannel);
    this.registerParticipant(context);
  }

  private registerParticipant(context: vscode.ExtensionContext) {
    // Check if Chat API is available
    if (!vscode.chat?.createChatParticipant) {
      console.log('GitHub Copilot Chat API not available - participant disabled');
      return;
    }

    // Create @babysitter participant
    this.participant = vscode.chat.createChatParticipant(
      'babysitter',
      async (request, context, stream, token) => {
        try {
          await this.handleRequest(request, context, stream, token);
        } catch (error) {
          stream.markdown(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    );

    // Set metadata
    this.participant.iconPath = vscode.Uri.file(
      context.asAbsolutePath('media/babysitter-icon.png')
    );

    // Add to subscriptions
    context.subscriptions.push(this.participant);

    console.log('Babysitter Copilot participant registered: @babysitter');
  }

  private async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    const prompt = request.prompt.trim();

    // Parse command
    const command = this.parseCommand(prompt);

    switch (command.type) {
      case 'dispatch':
        await this.handleDispatch(command.prompt ?? prompt, stream, token);
        break;
      case 'resume':
        await this.handleResume(command.runId, stream, token);
        break;
      case 'status':
        await this.handleStatus(command.runId, stream, token);
        break;
      case 'list':
        await this.handleList(stream, token);
        break;
      case 'processes':
        await this.handleProcesses(stream, token);
        break;
      case 'help':
        await this.handleHelp(stream, token);
        break;
      default:
        // Treat as dispatch request
        await this.handleDispatch(prompt, stream, token);
    }
  }

  private parseCommand(prompt: string): {
    type: 'dispatch' | 'resume' | 'status' | 'list' | 'processes' | 'help';
    prompt?: string;
    runId?: string;
  } {
    const lower = prompt.toLowerCase();

    if (lower.startsWith('resume')) {
      const runId = prompt.split(/\s+/)[1];
      return { type: 'resume', runId };
    }

    if (lower.startsWith('status')) {
      const runId = prompt.split(/\s+/)[1];
      return { type: 'status', runId };
    }

    if (lower === 'list' || lower === 'list runs') {
      return { type: 'list' };
    }

    if (lower === 'processes' || lower === 'list processes') {
      return { type: 'processes' };
    }

    if (lower === 'help' || lower === '?') {
      return { type: 'help' };
    }

    return { type: 'dispatch', prompt };
  }

  private async handleDispatch(
    prompt: string,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    stream.markdown('🚀 Creating new Babysitter run...\n\n');

    try {
      // Execute dispatch command
      const result = await vscode.commands.executeCommand(
        'babysitter.dispatchRun',
        { prompt, fromCopilot: true }
      ) as { runId: string; processId: string } | undefined;

      if (!result) {
        stream.markdown('❌ Failed to create run. Check Output panel for details.');
        return;
      }

      stream.markdown(`✅ **Run Created**\n\n`);
      stream.markdown(`- **Run ID:** \`${result.runId}\`\n`);
      stream.markdown(`- **Process:** ${result.processId}\n\n`);
      stream.markdown(`Monitor progress in **Explorer → Babysitter Runs**\n\n`);

      // Start background agent for this run
      const runsDir = (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath)
        ? require('path').join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.a5c', 'runs')
        : '.a5c/runs';
      const agent = new BabysitterBackgroundAgent(this.extensionContext, this.outputChannel);
      this.agents.set(result.runId, agent);
      // Fire-and-forget: progress is shown via vscode.window.withProgress inside the agent
      void agent.start(result.runId, runsDir);

      // Add helpful buttons
      stream.button({
        command: 'babysitter.openRunDetails',
        title: '📊 View Details',
        arguments: [result.runId]
      });

      stream.button({
        command: 'babysitter.openRunLogs',
        title: '📜 View Logs',
        arguments: [result.runId]
      });

    } catch (error) {
      stream.markdown(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleResume(
    runId: string | undefined,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    stream.markdown('🔄 Resuming Babysitter run...\n\n');

    try {
      const result = await vscode.commands.executeCommand(
        'babysitter.resumeRun',
        { runId, fromCopilot: true }
      ) as { runId: string; status: string } | undefined;

      if (!result) {
        stream.markdown('❌ No runs found to resume.');
        return;
      }

      stream.markdown(`✅ **Run Resumed**\n\n`);
      stream.markdown(`- **Run ID:** \`${result.runId}\`\n`);
      stream.markdown(`- **Status:** ${result.status}\n\n`);

      // Look up existing agent or create a new one for this run
      const runsDir = (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath)
        ? require('path').join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.a5c', 'runs')
        : '.a5c/runs';
      let agent = this.agents.get(result.runId);
      if (!agent) {
        agent = new BabysitterBackgroundAgent(this.extensionContext, this.outputChannel);
        this.agents.set(result.runId, agent);
      }
      if (agent.getStatus() !== 'running') {
        void agent.start(result.runId, runsDir);
      }

      stream.button({
        command: 'babysitter.openRunDetails',
        title: '📊 View Details',
        arguments: [result.runId]
      });

    } catch (error) {
      stream.markdown(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleStatus(
    runId: string | undefined,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      const runs = await this.runsManager.listRuns();
      
      if (runs.length === 0) {
        stream.markdown('No Babysitter runs found in `.a5c/runs/`');
        return;
      }

      const targetRun = runId 
        ? runs.find(r => r.id === runId || r.id.startsWith(runId))
        : runs[0]; // Latest run

      if (!targetRun) {
        stream.markdown(`❌ Run not found: ${runId}`);
        return;
      }

      const state = await this.sdk.getRunState(targetRun.id);

      stream.markdown(`📊 **Run Status**\n\n`);
      stream.markdown(`- **Run ID:** \`${targetRun.id}\`\n`);
      stream.markdown(`- **Status:** ${state.status}\n`);
      stream.markdown(`- **Created:** ${new Date(targetRun.createdAt).toLocaleString()}\n`);
      
      if (state.currentIteration) {
        stream.markdown(`- **Iteration:** ${state.currentIteration}/${state.maxIterations || '∞'}\n`);
      }

      if (state.qualityScore !== undefined) {
        stream.markdown(`- **Quality:** ${state.qualityScore}%\n`);
      }

      stream.markdown('\n');

      stream.button({
        command: 'babysitter.openRunDetails',
        title: '📊 View Full Details',
        arguments: [targetRun.id]
      });

    } catch (error) {
      stream.markdown(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleList(
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      const runs = await this.runsManager.listRuns();

      if (runs.length === 0) {
        stream.markdown('No Babysitter runs found in `.a5c/runs/`\n\n');
        stream.markdown('Create one with: `@babysitter <your request>`');
        return;
      }

      stream.markdown(`📋 **Babysitter Runs** (${runs.length})\n\n`);

      for (const run of runs.slice(0, 10)) { // Show latest 10
        const state = await this.sdk.getRunState(run.id);
        const statusEmoji = this.getStatusEmoji(state.status);
        
        stream.markdown(`${statusEmoji} **${run.id}**\n`);
        stream.markdown(`   Status: ${state.status} | Created: ${new Date(run.createdAt).toLocaleString()}\n\n`);
      }

      if (runs.length > 10) {
        stream.markdown(`\n_Showing 10 of ${runs.length} runs_\n`);
      }

      stream.button({
        command: 'workbench.view.explorer',
        title: '📂 View All in Explorer'
      });

    } catch (error) {
      stream.markdown(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleProcesses(
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      const processes = await this.sdk.listProcesses();

      if (processes.length === 0) {
        stream.markdown('No processes found in `.a5c/processes/`');
        return;
      }

      stream.markdown(`⚙️ **Available Processes** (${processes.length})\n\n`);

      for (const process of processes) {
        stream.markdown(`- **${process.id}**\n`);
        if (process.description) {
          stream.markdown(`  ${process.description}\n`);
        }
        stream.markdown('\n');
      }

    } catch (error) {
      stream.markdown(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleHelp(
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    stream.markdown('# 🤖 Babysitter Chat Participant\n\n');
    stream.markdown('Orchestrate complex, multi-step workflows via natural language.\n\n');
    
    stream.markdown('## Commands\n\n');
    stream.markdown('- `@babysitter <request>` - Start new run\n');
    stream.markdown('- `@babysitter resume [runId]` - Resume run\n');
    stream.markdown('- `@babysitter status [runId]` - Check status\n');
    stream.markdown('- `@babysitter list` - List all runs\n');
    stream.markdown('- `@babysitter processes` - List processes\n');
    stream.markdown('- `@babysitter help` - Show this help\n\n');

    stream.markdown('## Examples\n\n');
    stream.markdown('```\n');
    stream.markdown('@babysitter implement login with TDD and 85% quality\n');
    stream.markdown('@babysitter build and deploy API with approval gates\n');
    stream.markdown('@babysitter resume\n');
    stream.markdown('```\n\n');

    stream.button({
      command: 'vscode.open',
      title: '📖 Full Documentation',
      arguments: [vscode.Uri.file('.github/copilot-instructions.md')]
    });
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      case 'waiting': return '⏸️';
      default: return '📝';
    }
  }

  dispose() {
    this.participant?.dispose();
    for (const agent of this.agents.values()) {
      agent.dispose();
    }
    this.agents.clear();
  }
}
