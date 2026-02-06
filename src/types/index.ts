export type AgentType =
  | 'listings'
  | 'auctions'
  | 'crypto'
  | 'retail'
  | 'tickets'
  | 'collectibles'
  | 'books';

export type AgentStatus = 'idle' | 'running' | 'error';
export type RunStatus = 'running' | 'completed' | 'failed';
export type OpportunityStatus = 'new' | 'saved' | 'dismissed' | 'acted';

export interface AgentConfig {
  categories: string[];
  minProfit: number;
  region?: string;
  riskTolerance: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

export interface Agent {
  id: string;
  userId: string;
  type: AgentType;
  name: string;
  config: AgentConfig;
  status: AgentStatus;
  schedule: AgentSchedule | null;
  createdAt: string;
  // Derived / joined
  totalRuns?: number;
  totalOpportunities?: number;
  lastRunAt?: string | null;
  lastRunCost?: number;
}

export interface AgentSchedule {
  enabled: boolean;
  interval: 'hourly' | 'daily' | 'weekly';
  time?: string; // HH:MM for daily/weekly
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  tokensUsed: number;
  toolCalls: number;
  opportunitiesFound: number;
  error: string | null;
}

export interface FeeBreakdown {
  platformFee?: number;
  shippingCost?: number;
  paymentProcessing?: number;
  other?: number;
  total: number;
}

export interface Opportunity {
  id: string;
  agentRunId: string;
  agentType: AgentType;
  userId: string;
  title: string;
  description: string;
  buyPrice: number; // cents
  buySource: string;
  buyUrl: string;
  sellPrice: number; // cents
  sellSource: string;
  sellUrl: string;
  estimatedProfit: number; // cents
  fees: FeeBreakdown;
  confidence: number; // 0-100
  riskNotes: string[];
  reasoning: string;
  status: OpportunityStatus;
  actualBuyPrice: number | null;
  actualSellPrice: number | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  opportunityId: string;
  opportunity: Opportunity;
  lastCheckedAt: string;
  priceChange: {
    buyPriceDelta: number;
    sellPriceDelta: number;
    spreadChange: number;
  } | null;
  alertSent: boolean;
}

export interface AgentTypeInfo {
  type: AgentType;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  sources: string[];
}

export const AGENT_TYPES: Record<AgentType, AgentTypeInfo> = {
  listings: {
    type: 'listings',
    name: 'Listings Agent',
    shortName: 'Listings',
    description: 'Local marketplaces — Craigslist, FB Marketplace, OfferUp',
    icon: '🏷',
    color: '#3b82f6',
    sources: ['Craigslist', 'FB Marketplace', 'OfferUp'],
  },
  auctions: {
    type: 'auctions',
    name: 'Auction Agent',
    shortName: 'Auctions',
    description: 'eBay, estate sales, government auctions',
    icon: '🔨',
    color: '#f59e0b',
    sources: ['eBay', 'Estate Sales', 'Gov Auctions'],
  },
  crypto: {
    type: 'crypto',
    name: 'Crypto Agent',
    shortName: 'Crypto',
    description: 'Cross-exchange price spreads',
    icon: '₿',
    color: '#8b5cf6',
    sources: ['Binance', 'Coinbase', 'Kraken'],
  },
  retail: {
    type: 'retail',
    name: 'Retail Agent',
    shortName: 'Retail',
    description: 'Clearance sales, coupon stacking, resale potential',
    icon: '🛒',
    color: '#ec4899',
    sources: ['Target', 'Walmart', 'Amazon'],
  },
  tickets: {
    type: 'tickets',
    name: 'Tickets Agent',
    shortName: 'Tickets',
    description: 'Concert, sports, and event ticket arbitrage',
    icon: '🎫',
    color: '#ef4444',
    sources: ['Ticketmaster', 'StubHub', 'SeatGeek'],
  },
  collectibles: {
    type: 'collectibles',
    name: 'Collectibles Agent',
    shortName: 'Collectibles',
    description: 'Sneakers, trading cards, vinyl, LEGO',
    icon: '💎',
    color: '#06b6d4',
    sources: ['StockX', 'GOAT', 'TCGPlayer', 'Discogs'],
  },
  books: {
    type: 'books',
    name: 'Books/Media Agent',
    shortName: 'Books',
    description: 'Used books, textbooks, out-of-print media',
    icon: '📚',
    color: '#22c55e',
    sources: ['Thrift Stores', 'Library Sales', 'Amazon FBA'],
  },
};
