import * as fs from 'fs';
import * as path from 'path';

export interface RunInfo {
  id: string;
  createdAt: string;
  status?: string;
}

export class RunsManager {
  private readonly runsDir: string;

  constructor(runsDir = '.a5c/runs') {
    this.runsDir = runsDir;
  }

  async listRuns(): Promise<RunInfo[]> {
    try {
      const entries = fs.readdirSync(this.runsDir);
      const runs: RunInfo[] = [];

      for (const name of entries) {
        const dirPath = path.join(this.runsDir, name);
        try {
          const stat = fs.statSync(dirPath);
          if (!stat.isDirectory()) continue;

          const runJsonPath = path.join(dirPath, 'run.json');
          let createdAt = stat.mtime.toISOString();
          try {
            const meta = JSON.parse(fs.readFileSync(runJsonPath, 'utf8')) as { createdAt?: string };
            if (meta.createdAt) createdAt = meta.createdAt;
          } catch {
            // use mtime fallback
          }

          runs.push({ id: name, createdAt });
        } catch {
          // skip unreadable entries
        }
      }

      return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }
}
