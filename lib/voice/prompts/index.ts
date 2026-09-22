import fs from 'fs';
import path from 'path';

/**
 * The SDR talk-agent call script lives in lib/voice/prompts/sdr-talk-agent.md and is the
 * single source of truth for the Dograh "SDR Talk Agent" workflow instructions.
 */
export const SDR_TALK_AGENT_SCRIPT_PATH = path.join(
  process.cwd(),
  'lib',
  'voice',
  'prompts',
  'sdr-talk-agent.md'
);

export function getSdrTalkAgentScript(): string {
  return fs.readFileSync(SDR_TALK_AGENT_SCRIPT_PATH, 'utf-8');
}

/** Parses the `Script version: \`YYYY-MM-DD.n\`` line so the UI and docs can show which script is deployed. */
export function getSdrTalkAgentScriptVersion(script: string = getSdrTalkAgentScript()): string {
  const match = script.match(/Script version:\s*`([^`]+)`/);
  return match ? match[1] : 'unversioned';
}

/** Substitutes {{placeholders}} with pre-call context values (unknown keys are left in place). */
export function renderSdrTalkAgentScript(
  context: Record<string, string | undefined>,
  script: string = getSdrTalkAgentScript()
): string {
  return script.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? whole : String(value);
  });
}
