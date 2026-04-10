import { HermesClient, SecurityReviewResult } from './hermes';
import { Deployer } from './deployer';

// Pre-configured allowlist for known false positives
const FALSE_POSITIVE_ALLOWLIST: string[] = [
  // Add known false positive patterns here during initial setup
];

export interface SecurityGateResult {
  passed: boolean;
  review: SecurityReviewResult;
  clippyPassed: boolean;
  blockedReasons: string[];
}

/**
 * Multi-layer security gate for Anchor programs.
 * Runs: cargo clippy + LLM adversarial review.
 * Pass threshold: zero critical/high issues (after filtering allowlist).
 */
export class SecurityGate {
  private hermes: HermesClient;
  private deployer: Deployer;
  private enabled: boolean;

  constructor(hermes: HermesClient, deployer: Deployer) {
    this.hermes = hermes;
    this.deployer = deployer;
    this.enabled = process.env.SECURITY_GATE_ENABLED !== 'false';
  }

  async review(programName: string): Promise<SecurityGateResult> {
    if (!this.enabled) {
      console.log(`[security-gate] Disabled, skipping review for ${programName}`);
      return {
        passed: true,
        review: { pass: true, issues: [] },
        clippyPassed: true,
        blockedReasons: [],
      };
    }

    const blockedReasons: string[] = [];

    // Layer 1: cargo clippy
    console.log(`[security-gate] Running cargo clippy for ${programName}...`);
    const clippyResult = this.deployer.clippy(programName);
    const clippyPassed = clippyResult.success;
    if (!clippyPassed) {
      blockedReasons.push(`Clippy failed: ${clippyResult.error}`);
    }

    // Layer 2: LLM adversarial review
    console.log(`[security-gate] Running LLM security review for ${programName}...`);
    let review: SecurityReviewResult;
    try {
      const source = this.deployer.readProgramSource(programName);
      review = await this.hermes.securityReview(source);
    } catch (err: any) {
      console.error(`[security-gate] LLM review failed: ${err.message}`);
      review = { pass: false, issues: [{ severity: 'high', description: `LLM review error: ${err.message}`, location: 'N/A' }] };
    }

    // Filter out known false positives from allowlist
    const filteredIssues = review.issues.filter(
      (issue) => !FALSE_POSITIVE_ALLOWLIST.some((fp) => issue.description.includes(fp)),
    );

    // Check for critical/high issues
    const criticalHighIssues = filteredIssues.filter(
      (i) => i.severity === 'critical' || i.severity === 'high',
    );

    if (criticalHighIssues.length > 0) {
      for (const issue of criticalHighIssues) {
        blockedReasons.push(`[${issue.severity}] ${issue.description} at ${issue.location}`);
      }
    }

    // Log medium/low issues (don't block)
    const infoIssues = filteredIssues.filter(
      (i) => i.severity === 'medium' || i.severity === 'low',
    );
    for (const issue of infoIssues) {
      console.log(`[security-gate] [${issue.severity}] ${issue.description} at ${issue.location}`);
    }

    const passed = clippyPassed && criticalHighIssues.length === 0;

    console.log(`[security-gate] ${programName}: ${passed ? 'PASSED' : 'BLOCKED'} ` +
      `(clippy=${clippyPassed}, critical/high=${criticalHighIssues.length}, ` +
      `medium/low=${infoIssues.length})`);

    return {
      passed,
      review: { ...review, issues: filteredIssues },
      clippyPassed,
      blockedReasons,
    };
  }
}
