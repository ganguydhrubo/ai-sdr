import { describe, it, expect } from 'vitest';
import {
  getSdrTalkAgentScript,
  getSdrTalkAgentScriptVersion,
  renderSdrTalkAgentScript,
} from '../lib/voice/prompts';
import { DograhWebhookPayloadSchema } from '../lib/voice/schemas';
import { detectOptOutPhrase } from '../lib/voice/compliance';

describe('SDR talk-agent script (lib/voice/prompts/sdr-talk-agent.md)', () => {
  const script = getSdrTalkAgentScript();

  it('is versioned and carries the mandatory AI disclosure and recording consent', () => {
    expect(getSdrTalkAgentScriptVersion(script)).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(script).toContain('Disclose that you are an AI in your first sentence');
    expect(script).toMatch(/recorded and transcribed/i);
  });

  it('contains opt-out closing lines in English, Hindi and Bengali that the compliance detector recognises', () => {
    expect(script).toContain("You won't be");
    expect(script).toContain('dobara call nahi aayega');
    expect(script).toContain('Ar phone kora hobe');

    // The phrases the script tells the agent to treat as opt-outs must be ones compliance.ts detects.
    for (const phrase of ["don't call", 'call mat karo', 'nahi chahiye', 'ar phone korben na']) {
      expect(detectOptOutPhrase(phrase).isOptOut, phrase).toBe(true);
    }
  });

  it('asks the agent to fill exactly the gathered_context fields the webhook schema accepts', () => {
    const gathered = DograhWebhookPayloadSchema.shape.gathered_context.unwrap();
    const schemaKeys = Object.keys(gathered.shape);
    for (const key of schemaKeys) {
      expect(script, `script must mention gathered_context field "${key}"`).toContain(`"${key}"`);
    }
  });

  it('renders pre-call placeholders and leaves unknown ones untouched', () => {
    const rendered = renderSdrTalkAgentScript(
      { first_name: 'Rajesh', company: 'Pune Gears Pvt Ltd', org_name: 'Apex Technologies' },
      'Hi {{first_name}} from {{company}}, this is {{org_name}} — slot {{slot in words}}'
    );
    expect(rendered).toBe('Hi Rajesh from Pune Gears Pvt Ltd, this is Apex Technologies — slot {{slot in words}}');
  });
});
