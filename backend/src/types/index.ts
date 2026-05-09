export type RiskLevel = 'safe' | 'suspicious' | 'high_risk' | 'confirmed_scam';

export interface AgentFinding {
  agentId: number;
  agentName: string;
  status: 'running' | 'complete' | 'failed';
  searchQueries: string[];          // every query the agent fired
  rawSearchResults: SearchResult[]; // every URL it found
  findings: Record<string, unknown>; // structured conclusions
  confidence: number;               // 0-100
  executionMs: number;
  error?: string;
}

export interface SearchResult {
  query: string;
  url: string;
  title: string;
  snippet: string;
  source: string;
}

// ── Agent 1: Telecom ──────────────────────────────────────────────────────────
export interface TelecomFindings {
  carrier: string | null;
  telecomCircle: string | null;
  numberType: 'mobile' | 'landline' | 'voip' | 'toll_free' | 'unknown';
  country: string | null;
  isPorted: boolean;
  portedFrom: string | null;
  registeredCity: string | null;
  registeredState: string | null;
  isActive: boolean | null;
  traiData: string | null;
}

// ── Agent 2: Spam ─────────────────────────────────────────────────────────────
export interface SpamFindings {
  totalReportsFound: number;
  spamScore: number; // 0-100
  confidence: 'None' | 'Low' | 'Medium' | 'High' | 'Confirmed';
  categories: string[];
  sourceSummaries: Array<{
    source: string;
    url: string;
    reportCount: number;
    category: string;
    excerpt: string;
  }>;
  firstSeen: string | null;
  lastSeen: string | null;
  knownNames: string[];  // names callers used when calling victims
  modus: string | null;  // how the scam works
}

// ── Agent 3: Digital Identity ─────────────────────────────────────────────────
export interface DigitalIdentityFindings {
  associatedEmails: Array<{ email: string; source: string; url: string }>;
  associatedNames: Array<{ name: string; source: string; url: string }>;
  associatedUsernames: Array<{ username: string; platform: string; url: string }>;
  associatedDomains: Array<{ domain: string; whois: string | null; url: string }>;
  classifiedAds: Array<{ platform: string; title: string; url: string; snippet: string }>;
  businessListings: Array<{ name: string; platform: string; url: string; address: string | null }>;
  pasteFinds: Array<{ url: string; snippet: string }>;
}

// ── Agent 4: Social & Web Presence ────────────────────────────────────────────
export interface SocialFindings {
  socialProfiles: Array<{
    platform: string;
    url: string;
    name: string | null;
    bio: string | null;
    isVerified: boolean;
    followers: string | null;
    posts: string[];
  }>;
  companyRegistrations: Array<{
    name: string;
    registrationNumber: string | null;
    status: string | null;
    address: string | null;
    source: string;
    url: string;
  }>;
  newsArticles: Array<{ title: string; url: string; date: string | null; summary: string }>;
  courtRecords: Array<{ case: string; court: string; url: string; summary: string }>;
  gstDetails: Array<{ gstin: string; name: string; address: string; url: string }>;
  youtubeChannels: Array<{ name: string; url: string; subscribers: string | null }>;
}

// ── Agent 5: Location ─────────────────────────────────────────────────────────
export interface LocationFindings {
  country: string | null;
  state: string | null;
  city: string | null;
  district: string | null;
  locality: string | null; // area / sector level only — never residential
  pincode: string | null;
  locationConfidence: 'Low' | 'Medium' | 'High';
  signals: Array<{
    signalSource: string;
    sourceUrl: string;
    inferredLocation: string;
    confidence: 'Low' | 'Medium' | 'High';
    reasoning: string;
  }>;
  isKnownScamZone: boolean;
  scamZoneName: string | null;
  scamZoneNotes: string | null;
  ipGeolocation: string | null;
}

export interface FinancialFindings {
  fundingRounds: number;
  totalFundingAmount: string | null;
  latestValuation: string | null;
  investors: string[];
  loansOrCharges: Array<{
    bankOrEntity: string;
    amount: string;
    date: string;
    status: string;
  }>;
  financialHealth: 'Excellent' | 'Good' | 'Poor' | 'Unknown';
  financialDisputes: string[];
}

// ── Final Report ──────────────────────────────────────────────────────────────
export interface InvestigationReport {
  id: string;
  input: string;
  inputType: 'phone' | 'email' | 'name' | 'business';
  createdAt: string;
  status: 'complete' | 'partial' | 'failed';
  executionMs: number;

  // Overall verdict
  rating: number; // 1.0 to 5.0
  safetyVerdict: 'safe' | 'unsafe';
  riskReasoning: string;

  // Per-agent findings
  telecom: TelecomFindings | null;
  spam: SpamFindings | null;
  digitalIdentity: DigitalIdentityFindings | null;
  social: SocialFindings | null;
  location: LocationFindings | null;
  financial: FinancialFindings | null;

  // All raw agent objects (for detailed view)
  agentLogs: AgentFinding[];

  // Deduped source index
  sources: SearchResult[];

  // Orchestrator's final synthesis (Dossier)
  summary: string;
  summaryPoints?: string[];
  inferredProvider?: string | null;
  inferredLocation?: string | null;
  profileImageUrls: string[]; // Grid of discovered images
  extractedContacts: Array<{ type: 'phone' | 'email' | 'social'; value: string }>;
  keyFacts: string[];
  recommendations: string[];
}

export interface InvestigateRequest {
  input: string;
  inputType?: 'phone' | 'email' | 'name' | 'business';
}

export interface StreamEvent {
  type: 'agent_start' | 'agent_search' | 'agent_result' | 'agent_complete' | 'agent_error' | 'report_ready' | 'error';
  agentId?: number;
  agentName?: string;
  query?: string;
  result?: unknown;
  report?: InvestigationReport;
  message?: string;
  timestamp: string;
}
