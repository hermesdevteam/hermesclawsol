import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface HermesResponse {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface SecurityReviewResult {
  pass: boolean;
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    location: string;
  }>;
}

/**
 * Client for NousResearch Hermes LLM via OpenClaw gateway.
 * Handles code parameterization and adversarial security review.
 */
export class HermesClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || process.env.OPENCLAW_URL || 'http://localhost:3000';
    this.model = model || process.env.HERMES_MODEL || 'nousresearch/hermes-3-llama-3.1-405b';
  }

  async chat(systemPrompt: string, userMessage: string): Promise<HermesResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
    };
  }

  /**
   * Parameterize an Anchor program template using Hermes LLM.
   * Reads the template config JSON and generates appropriate parameter values.
   */
  async parameterize(templateConfigPath: string): Promise<Record<string, unknown>> {
    const config = JSON.parse(readFileSync(resolve(templateConfigPath), 'utf-8'));
    const fields = config.parameterizable_fields;

    const prompt = `You are HermesClawSol, an autonomous Solana builder agent.
Given this staking program template configuration, generate optimal parameter values.
Consider: maximizing user engagement, maintaining sustainable tokenomics, and ensuring competitive APR.

Template config:
${JSON.stringify(fields, null, 2)}

Respond with ONLY a valid JSON object mapping field names to values within the specified ranges.
No explanation, no markdown, just the JSON object.`;

    const response = await this.chat(
      'You are a DeFi parameter optimizer. Output only valid JSON.',
      prompt,
    );

    return JSON.parse(response.content);
  }

  /**
   * Adversarial security review of generated Anchor/Rust code.
   * Returns structured findings with severity levels.
   */
  async securityReview(rustSourceCode: string): Promise<SecurityReviewResult> {
    const prompt = `You are a Solana smart contract security auditor. Review this Anchor/Rust program for vulnerabilities.

Check for:
1. Missing signer constraints (any account that should be a Signer but isn't)
2. Unsafe arithmetic (operations that could overflow/underflow without checked_* methods)
3. PDA seed collisions (seeds that could produce the same PDA for different logical entities)
4. Missing has_one checks (accounts not validated against stored references)
5. Unchecked account ownership (accounts not verified to belong to expected programs)
6. Missing rent exemption checks
7. Reinitialization vulnerabilities
8. Authority escalation paths

Source code:
\`\`\`rust
${rustSourceCode}
\`\`\`

Respond with ONLY a valid JSON object in this exact format:
{
  "pass": true/false,
  "issues": [
    {"severity": "critical|high|medium|low", "description": "...", "location": "line or function name"}
  ]
}

Set pass=true ONLY if there are zero critical or high severity issues.`;

    const response = await this.chat(
      'You are a Solana security auditor. Output only valid JSON. Be thorough but avoid false positives.',
      prompt,
    );

    return JSON.parse(response.content) as SecurityReviewResult;
  }

  /**
   * Generate a natural-language deployment announcement for X/Twitter.
   */
  async generateAnnouncement(
    programName: string,
    programId: string,
    description: string,
  ): Promise<string> {
    const response = await this.chat(
      `You are HermesClawSol, an autonomous Solana builder agent. You speak in first person.
Your personality: confident, technical, witty. You reference Greek mythology occasionally.
Keep tweets under 280 characters. Include the program ID. No hashtags. No emojis.`,
      `Generate a deployment announcement tweet for:
Program: ${programName}
ID: ${programId}
Description: ${description}`,
    );

    return response.content.trim();
  }
}
