import { Lead, VoiceSettings } from '../types';
import { ComplianceGuard } from '../compliance/guard';

export interface ISTWindowResult {
  allowed: boolean;
  istHour: number;
  istMinute: number;
  timeString: string;
  reason?: string;
}

/**
 * Checks if a given timestamp falls within TRAI calling hours (09:00 - 21:00 IST).
 */
export function checkCallingWindowIST(date: Date = new Date()): ISTWindowResult {
  // IST is UTC + 5 hours and 30 minutes (330 minutes)
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  const istDate = new Date(utcTime + 330 * 60000);

  const istHour = istDate.getHours();
  const istMinute = istDate.getMinutes();
  const timeString = `${String(istHour).padStart(2, '0')}:${String(istMinute).padStart(2, '0')} IST`;

  // TRAI window: 09:00 to 21:00 IST
  if (istHour < 9 || istHour >= 21) {
    return {
      allowed: false,
      istHour,
      istMinute,
      timeString,
      reason: `Outbound calling restricted outside 09:00–21:00 IST (Current IST time is ${timeString}). Ref: TRAI TCCCPR Regulations.`,
    };
  }

  return {
    allowed: true,
    istHour,
    istMinute,
    timeString,
  };
}

export interface OptOutDetectionResult {
  isOptOut: boolean;
  matchedPhrase?: string;
  language?: 'en' | 'hi' | 'bn';
}

const OPT_OUT_PATTERNS: Array<{ regex: RegExp; phrase: string; lang: 'en' | 'hi' | 'bn' }> = [
  // English phrases
  { regex: /\b(stop calling|don'?t call|do not call|remove my number|take me off|take us off)\b/i, phrase: 'stop calling', lang: 'en' },
  { regex: /\b(unsubscribe|put me on (dnd|do not disturb)|cancel my subscription|delete my data)\b/i, phrase: 'unsubscribe / DND', lang: 'en' },
  { regex: /\b(not interested|never call again|never contact me again|lose this number)\b/i, phrase: 'not interested / never contact', lang: 'en' },
  { regex: /\b(harassing|report you to trai|report this number)\b/i, phrase: 'TRAI violation complaint', lang: 'en' },

  // Hindi / Hinglish phrases
  { regex: /\b(phone mat karo|call mat karo|mujhe call mat karna|call mat kijiye)\b/i, phrase: 'call mat karo', lang: 'hi' },
  { regex: /\b(dobara call mat karna|phir se phone mat karna|dobara mat bolna)\b/i, phrase: 'dobara call mat karna', lang: 'hi' },
  { regex: /\b(number hata do|mera number delete karo|list se hatao)\b/i, phrase: 'number hata do', lang: 'hi' },
  { regex: /\b(pareshan mat karo|dimag kharab mat karo|tangle mat karo)\b/i, phrase: 'pareshan mat karo', lang: 'hi' },
  { regex: /\b(nahi chahiye|humein nahi chahiye|interest nahi hai|nahi lena hai)\b/i, phrase: 'nahi chahiye / no interest', lang: 'hi' },
  { regex: /\b(band karo yeh call|abhi phone kato)\b/i, phrase: 'band karo yeh call', lang: 'hi' },

  // Bengali / Banglish phrases
  { regex: /\b(ar phone korben na|phone korben na|call korben na|ar call korben na)\b/i, phrase: 'ar phone korben na', lang: 'bn' },
  { regex: /\b(amar number ta delete korun|number remove korun|list theke bad din)\b/i, phrase: 'number delete korun', lang: 'bn' },
  { regex: /\b(amake ar phone korben na|birokto korben na|disturb korben na)\b/i, phrase: 'birokto korben na', lang: 'bn' },
  { regex: /\b(amader dorkar nei|lagbe na|chai na|kono dorkar nei)\b/i, phrase: 'dorkar nei / lagbe na', lang: 'bn' },
];

/**
 * Scans a voice transcript segment or utterance for opt-out or DND demands
 * in English, Hindi, and Bengali.
 */
export function detectOptOutPhrase(transcriptOrInput: string): OptOutDetectionResult {
  if (!transcriptOrInput || typeof transcriptOrInput !== 'string') {
    return { isOptOut: false };
  }

  for (const item of OPT_OUT_PATTERNS) {
    if (item.regex.test(transcriptOrInput)) {
      return {
        isOptOut: true,
        matchedPhrase: item.phrase,
        language: item.lang,
      };
    }
  }

  return { isOptOut: false };
}

/**
 * Validates whether a caller ID conforms to TRAI 140 / 1600 / 1601 commercial series.
 */
export function isTraiCompliantCallerId(callerId?: string): boolean {
  if (!callerId) return false;
  const clean = callerId.replace(/[^\d]/g, '');

  // Must match 140..., 91140..., 1600..., 911600..., 1601..., 911601...
  return (
    clean.startsWith('140') ||
    clean.startsWith('91140') ||
    clean.startsWith('1600') ||
    clean.startsWith('911600') ||
    clean.startsWith('1601') ||
    clean.startsWith('911601')
  );
}

export interface PstnComplianceCheckResult {
  allowed: boolean;
  violations: string[];
}

/**
 * Executes the 8 mandatory TRAI, DLT, and safety checks before initiating any outbound PSTN call.
 */
export function checkPstnOutboundCompliance(
  lead: Lead,
  settings: VoiceSettings,
  options?: { advanceNoticeGiven?: boolean }
): PstnComplianceCheckResult {
  const violations: string[] = [];

  // 1. Global Kill Switch Check
  if (ComplianceGuard.isEmergencyKillSwitchActive()) {
    violations.push('Global emergency kill switch is currently engaged.');
  }

  // 2. Voice Module Check
  if (!settings.voice_enabled) {
    violations.push('Voice module is disabled in organization settings.');
  }

  // 3. PSTN Outbound Route Enabled Check
  if (!settings.pstn_enabled) {
    violations.push('PSTN outbound calling is disabled in organization voice settings.');
  }

  // 4. Calling Window IST Check
  const windowCheck = checkCallingWindowIST();
  if (!windowCheck.allowed) {
    violations.push(windowCheck.reason || 'Outside permitted 09:00–21:00 IST calling hours.');
  }

  // 5. DLT Entity ID Check
  if (!settings.dlt_entity_id || settings.dlt_entity_id.trim() === '') {
    violations.push('Missing registered DLT Principal Entity ID (TRAI TCCCPR-2018 mandatory requirement).');
  }

  // 6. TRAI-Compliant Caller ID Series Check
  if (!settings.caller_id_series || !isTraiCompliantCallerId(settings.caller_id_series)) {
    violations.push(
      `Caller ID '${settings.caller_id_series || 'UNSET'}' violates TRAI commercial numbering regulations. Must originate from 140, 1600, or 1601 series.`
    );
  }

  // 7. Advance OAP Autodialer Notice Check
  const advanceNotice = options?.advanceNoticeGiven ?? settings.advance_notice_given;
  if (!advanceNotice) {
    violations.push(
      'Advance notice has not been filed with Originating Access Provider (OAP) for autodialer/automated calling.'
    );
  }

  // 8. Suppression & Express Consent Check
  if (lead.is_suppressed) {
    violations.push(`Prospect is flagged as suppressed: ${lead.suppression_reason || 'DO NOT CONTACT'}`);
  }

  if (lead.is_dnc_registered) {
    violations.push('Prospect is registered on National Do Not Call (NDNC / DND) registry without express consent exemption.');
  }

  const suppressionCheck = ComplianceGuard.isSuppressed(lead.email, lead.phone, lead.company_name);
  if (suppressionCheck.suppressed) {
    violations.push(`Suppression violation: ${suppressionCheck.reason}`);
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}

// ==========================================
// ORGANISATION-LEVEL PSTN READINESS GATE (Voice Settings UI)
// ==========================================

export interface PstnGateItem {
  id:
    | 'kill_switch'
    | 'voice_enabled'
    | 'pstn_enabled'
    | 'calling_window'
    | 'dlt_entity_id'
    | 'caller_id_series'
    | 'oap_advance_notice'
    | 'lead_scrubbing';
  label: string;
  passed: boolean;
  detail: string;
  /** What the operator must do when the item fails. */
  action?: string;
  /** Evaluated per lead at dial time rather than from settings. */
  runtime?: boolean;
}

export interface PstnGateEvaluation {
  ready: boolean;
  passed: number;
  total: number;
  items: PstnGateItem[];
  evaluatedAt: string;
}

/**
 * The same eight checks as checkPstnOutboundCompliance(), expressed as a checklist the
 * Voice Settings page can render. Items 1–7 come from organisation settings; item 8
 * (suppression / NDNC) is evaluated for every lead when a call is triggered.
 */
export function evaluatePstnGate(settings: VoiceSettings, now: Date = new Date()): PstnGateEvaluation {
  const window = checkCallingWindowIST(now);
  const callerIdOk = !!settings.caller_id_series && isTraiCompliantCallerId(settings.caller_id_series);
  const killSwitchActive = ComplianceGuard.isEmergencyKillSwitchActive();

  const items: PstnGateItem[] = [
    {
      id: 'kill_switch',
      label: 'Global emergency kill switch is off',
      passed: !killSwitchActive,
      detail: killSwitchActive ? 'Kill switch is engaged — all outbound is frozen.' : 'Outreach queues are running.',
      action: 'Resume outreach from Admin & Guardrails once the incident is over.',
    },
    {
      id: 'voice_enabled',
      label: 'Voice module enabled',
      passed: settings.voice_enabled,
      detail: settings.voice_enabled ? 'Voice module is on.' : 'Voice module is disabled for the organisation.',
      action: 'Turn on the voice module below.',
    },
    {
      id: 'pstn_enabled',
      label: 'PSTN outbound route enabled',
      passed: settings.pstn_enabled,
      detail: settings.pstn_enabled
        ? 'Outbound phone calls via Dograh + Vobiz are enabled.'
        : 'PSTN is off — only zero-cost WebRTC talk links are active.',
      action: 'Enable PSTN only after every item below passes and the Vobiz trunk is commercially live.',
    },
    {
      id: 'calling_window',
      label: 'TRAI calling window 09:00–21:00 IST',
      passed: settings.calling_window_start === '09:00' && settings.calling_window_end === '21:00',
      detail:
        `Configured ${settings.calling_window_start}–${settings.calling_window_end} ${settings.timezone}. ` +
        (window.allowed ? `Calls are permitted right now (${window.timeString}).` : `Calls are blocked right now (${window.timeString}).`),
      action: 'The window is fixed by TRAI TCCCPR; reset it to 09:00–21:00 Asia/Kolkata.',
    },
    {
      id: 'dlt_entity_id',
      label: 'DLT Principal Entity ID registered',
      passed: !!settings.dlt_entity_id && settings.dlt_entity_id.trim() !== '',
      detail: settings.dlt_entity_id ? `Entity ID ${settings.dlt_entity_id}` : 'No DLT Principal Entity ID on file.',
      action: 'Register on a TRAI DLT platform (e.g. via the telecom operator) and enter the Principal Entity ID.',
    },
    {
      id: 'caller_id_series',
      label: 'Caller ID in TRAI 140 / 1600 / 1601 series',
      passed: callerIdOk,
      detail: callerIdOk
        ? `Caller ID series ${settings.caller_id_series} is a commercial series.`
        : `Caller ID '${settings.caller_id_series || 'UNSET'}' is not a 140/1600/1601 series number.`,
      action: 'Obtain a 140-series (promotional) or 1600-series (transactional/service) number from the operator via Vobiz.',
    },
    {
      id: 'oap_advance_notice',
      label: 'Advance autodialer notice filed with the OAP',
      passed: !!settings.advance_notice_given,
      detail: settings.advance_notice_given
        ? `Notice filed${settings.oap_autodialer_notice_date ? ` on ${settings.oap_autodialer_notice_date}` : ''}${settings.oap_notice_doc_url ? ' (document on file)' : ''}.`
        : 'No advance notice recorded for automated/autodialer calling.',
      action: 'File the advance notice with the Originating Access Provider and record the date and document link.',
    },
    {
      id: 'lead_scrubbing',
      label: 'Suppression list & NDNC scrubbing per lead',
      passed: true,
      runtime: true,
      detail: 'Checked for every lead at dial time: suppression list, DND registry flag and express-consent exemption.',
    },
  ];

  const passed = items.filter((i) => i.passed).length;
  return {
    ready: items.every((i) => i.passed),
    passed,
    total: items.length,
    items,
    evaluatedAt: now.toISOString(),
  };
}
