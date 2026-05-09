export type RiskLevel = 'safe' | 'suspicious' | 'high_risk' | 'confirmed_scam';

export interface SearchResult {
  query: string; url: string; title: string; snippet: string; source: string;
}

export interface AgentFinding {
  agentId: number; agentName: string; status: string;
  searchQueries: string[]; rawSearchResults: SearchResult[];
  findings: Record<string, unknown>; confidence: number;
  executionMs: number; error?: string;
}

export interface TelecomFindings {
  carrier: string | null; telecomCircle: string | null;
  numberType: string; country: string | null;
  isPorted: boolean; portedFrom: string | null;
  registeredCity: string | null; registeredState: string | null;
  isActive: boolean | null; traiData: string | null;
}

export interface SpamFindings {
  totalReportsFound: number; spamScore: number;
  confidence: string; categories: string[];
  sourceSummaries: Array<{ source: string; url: string; reportCount: number; category: string; excerpt: string }>;
  firstSeen: string | null; lastSeen: string | null;
  knownNames: string[]; modus: string | null;
}

export interface DigitalIdentityFindings {
  associatedEmails: Array<{ email: string; source: string; url: string }>;
  associatedNames: Array<{ name: string; source: string; url: string }>;
  associatedUsernames: Array<{ username: string; platform: string; url: string }>;
  associatedDomains: Array<{ domain: string; whois: string | null; url: string }>;
  classifiedAds: Array<{ platform: string; title: string; url: string; snippet: string }>;
  businessListings: Array<{ name: string; platform: string; url: string; address: string | null }>;
  pasteFinds: Array<{ url: string; snippet: string }>;
}

export interface SocialFindings {
  socialProfiles: Array<{ platform: string; url: string; name: string | null; bio: string | null; isVerified: boolean; followers: string | null; posts: string[] }>;
  companyRegistrations: Array<{ name: string; registrationNumber: string | null; status: string | null; address: string | null; source: string; url: string }>;
  newsArticles: Array<{ title: string; url: string; date: string | null; summary: string }>;
  courtRecords: Array<{ case: string; court: string; url: string; summary: string }>;
  gstDetails: Array<{ gstin: string; name: string; address: string; url: string }>;
  youtubeChannels: Array<{ name: string; url: string; subscribers: string | null }>;
}

export interface LocationFindings {
  country: string | null; state: string | null; city: string | null;
  district: string | null; locality: string | null; pincode: string | null;
  locationConfidence: string;
  signals: Array<{ signalSource: string; sourceUrl: string; inferredLocation: string; confidence: string; reasoning: string }>;
  isKnownScamZone: boolean; scamZoneName: string | null; scamZoneNotes: string | null;
  ipGeolocation: string | null;
}

export interface InvestigationReport {
  id: string; input: string; inputType: string; createdAt: string;
  status: string; executionMs: number;
  riskLevel: RiskLevel; riskScore: number; riskReasoning: string;
  telecom: TelecomFindings | null; spam: SpamFindings | null;
  digitalIdentity: DigitalIdentityFindings | null; social: SocialFindings | null;
  location: LocationFindings | null; agentLogs: AgentFinding[];
  sources: SearchResult[]; summary: string; keyFacts: string[]; recommendations: string[];
}

export interface StreamEvent {
  type: string; agentId?: number; agentName?: string;
  query?: string; result?: unknown; report?: InvestigationReport;
  message?: string; timestamp: string;
}

export interface AgentState {
  id: number; name: string;
  status: 'idle' | 'running' | 'complete' | 'failed';
  searches: string[]; searchCount: number; finding?: unknown;
  executionMs?: number;
}
