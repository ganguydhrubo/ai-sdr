import type {
  AIRun,
  AuditLog,
  Campaign,
  CampaignStep,
  Company,
  Conversation,
  ICPConfig,
  Lead,
  Meeting,
  Organization,
  OutboundMessage,
  TalkSession,
  Task,
  User,
  VoiceCall,
  VoiceSettings,
  WhatsAppAntiBanSettings,
} from './types';
import type { SuppressionEntry } from './compliance/guard';
import type { VoiceAnalytics } from './voice/analytics';
import type { IntegrationStatus } from './integrations/status';

/** Everything the admin UI renders, served by GET /api/state from the server-side store. */
export interface AppStats {
  totalLeads: number;
  qualifiedLeads: number;
  contacted: number;
  engaged: number;
  meetings: number;
  opportunities: number;
  handoffs: number;
  pendingApprovals: number;
  queuedMessages: number;
  failedMessages: number;
  sentMessages: number;
  repliedMessages: number;
  pendingTasks: number;
  activeCampaigns: number;
  suppressedLeads: number;
  leadsToday: number;
  conversionRate: string;
  replyRate: string;
  aiSpendCurrentMonth: number;
  aiBudgetTotal: number;
  aiRunsCount: number;
  aiTokensTotal: number;
  aiAvgLatencyMs: number;
  killSwitchActive: boolean;
}

export interface CallingWindow {
  allowed: boolean;
  timeString: string;
  reason?: string;
}

export interface AppState {
  org: Organization;
  users: User[];
  icp: ICPConfig;
  companies: Company[];
  leads: Lead[];
  campaigns: Campaign[];
  campaignSteps: CampaignStep[];
  messages: OutboundMessage[];
  conversations: Conversation[];
  meetings: Meeting[];
  tasks: Task[];
  auditLogs: AuditLog[];
  aiRuns: AIRun[];
  talkSessions: TalkSession[];
  voiceCalls: VoiceCall[];
  voiceSettings: VoiceSettings;
  suppressionList: SuppressionEntry[];
  whatsappAntiBan: WhatsAppAntiBanSettings;
  stats: AppStats;
  voiceAnalytics: VoiceAnalytics;
  callingWindow: CallingWindow;
  integrations: IntegrationStatus;
  appUrl: string;
  serverTime: string;
}
