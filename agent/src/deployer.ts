import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface DeployResult {
  success: boolean;
  programId?: string;
  error?: string;
  buildOutput?: string;
  testOutput?: string;
}

/**
 * Handles Anchor build, test, and deploy operations.
 * Uses execFileSync (no shell) to prevent command injection.
 */
export class Deployer {
  private projectRoot: string;
  private cluster: string;

  constructor(projectRoot?: string, cluster?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.cluster = cluster || 'devnet';
  }

  /**
   * Build a specific Anchor program.
   */
  build(programName: string): DeployResult {
    try {
      const output = execFileSync('anchor', ['build', '-p', programName], {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 120_000,
      });
      console.log(`[deployer] Build succeeded for ${programName}`);
      return { success: true, buildOutput: output };
    } catch (err: any) {
      console.error(`[deployer] Build failed for ${programName}: ${err.message}`);
      return { success: false, error: err.message, buildOutput: err.stdout };
    }
  }

  /**
   * Run tests for a specific program.
   */
  test(programName: string): DeployResult {
    try {
      const output = execFileSync('anchor', ['test', '--skip-deploy'], {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 180_000,
      });
      console.log(`[deployer] Tests passed for ${programName}`);
      return { success: true, testOutput: output };
    } catch (err: any) {
      console.error(`[deployer] Tests failed for ${programName}: ${err.message}`);
      return { success: false, error: err.message, testOutput: err.stdout };
    }
  }

  /**
   * Run cargo clippy for static analysis.
   */
  clippy(programName: string): DeployResult {
    try {
      const output = execFileSync('cargo', ['clippy', '-p', programName, '--', '-D', 'warnings'], {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 120_000,
      });
      console.log(`[deployer] Clippy passed for ${programName}`);
      return { success: true, buildOutput: output };
    } catch (err: any) {
      console.error(`[deployer] Clippy failed for ${programName}: ${err.message}`);
      return { success: false, error: err.message, buildOutput: err.stdout };
    }
  }

  /**
   * Deploy a program to the configured cluster.
   */
  deploy(programName: string): DeployResult {
    try {
      const output = execFileSync(
        'anchor',
        ['deploy', '--provider.cluster', this.cluster, '-p', programName],
        {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          timeout: 120_000,
        },
      );

      // Parse program ID from output
      const match = output.match(/Program Id: ([A-Za-z0-9]+)/);
      const programId = match ? match[1] : undefined;

      console.log(`[deployer] Deployed ${programName} to ${this.cluster}: ${programId}`);
      return { success: true, programId, buildOutput: output };
    } catch (err: any) {
      console.error(`[deployer] Deploy failed for ${programName}: ${err.message}`);
      return { success: false, error: err.message, buildOutput: err.stdout };
    }
  }

  /**
   * Read the source code of a program for security review.
   */
  readProgramSource(programName: string): string {
    const srcPath = resolve(this.projectRoot, 'programs', programName, 'src', 'lib.rs');
    if (!existsSync(srcPath)) {
      throw new Error(`Program source not found: ${srcPath}`);
    }
    return readFileSync(srcPath, 'utf-8');
  }

  /**
   * Git commit deployed code.
   */
  gitCommit(message: string): boolean {
    try {
      execFileSync('git', ['add', '-A'], {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 30_000,
      });
      execFileSync('git', ['commit', '-m', message], {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 30_000,
      });
      return true;
    } catch {
      return false;
    }
  }
}
