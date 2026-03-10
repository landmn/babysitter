import * as fs from 'fs';
import * as path from 'path';

export interface RunState {
  status: 'running' | 'waiting' | 'completed' | 'failed' | string;
  currentIteration?: number;
  maxIterations?: number;
  qualityScore?: number;
}

export interface ProcessInfo {
  id: string;
  description?: string;
}

interface StateJson {
  status?: string;
  iteration?: number;
  maxIterations?: number;
  qualityScore?: number;
}

export class BabysitterSDK {
  private readonly runsDir: string;
  private readonly processesDir: string;

  constructor(runsDir = '.a5c/runs', processesDir = '.a5c/processes') {
    this.runsDir = runsDir;
    this.processesDir = processesDir;
  }

  async getRunState(runId: string): Promise<RunState> {
    const stateFile = path.join(this.runsDir, runId, 'state', 'state.json');
    try {
      const raw = fs.readFileSync(stateFile, 'utf8');
      const parsed = JSON.parse(raw) as StateJson;
      return {
        status: parsed.status ?? 'running',
        currentIteration: parsed.iteration,
        maxIterations: parsed.maxIterations,
        qualityScore: parsed.qualityScore,
      };
    } catch {
      return { status: 'running' };
    }
  }

  async listProcesses(): Promise<ProcessInfo[]> {
    try {
      const entries = fs.readdirSync(this.processesDir);
      return entries
        .filter((e) => e.endsWith('.js') || e.endsWith('.ts'))
        .map((e) => ({
          id: e.replace(/\.(js|ts)$/, ''),
        }));
    } catch {
      return [];
    }
  }
}
