# Airbitrage

## Overview
Airbitrage is an arbitrage discovery platform powered by AI agents. Users deploy a team of specialized agents that search the web for real arbitrage opportunities — items for sale at one price where a real opportunity exists to sell at a higher price elsewhere. Users review and act on opportunities; the app surfaces them.

Each agent type has its own dedicated section/tab in the UI with tailored views, filters, and controls specific to that arbitrage category.

## Agent Types
- **Listings Agent** — Local marketplaces (Craigslist, FB Marketplace, OfferUp). Finds underpriced items that sell for more on eBay/Amazon/other platforms.
- **Auction Agent** — eBay, estate sales, government auctions. Spots mispriced lots, ending-soon auctions with low bids, and bulk liquidation deals.
- **Crypto Agent** — Cross-exchange price spreads (Binance, Coinbase, Kraken). Monitors real-time price differentials and withdrawal/deposit fee math.
- **Retail Agent** — Clearance sales, coupon stacking, resale potential. Finds retail arbitrage where clearance + coupons create profitable resale on Amazon FBA or eBay.
- **Tickets Agent** — Concert, sports, and event tickets. Finds underpriced tickets on primary platforms (Ticketmaster, venue pre-sales) that resell for more on StubHub/SeatGeek/VividSeats. Also catches mispriced resale listings.
- **Collectibles Agent** — Limited-release sneakers, trading cards (Pokemon, sports), vinyl records, LEGO sets. Tracks StockX, GOAT, TCGPlayer, Discogs for buy-low opportunities against market averages.
- **Books/Media Agent** — Used books, textbooks near semester boundaries, out-of-print media. Scans thrift stores, library sales, estate sales against Amazon/eBay sold prices. Core Amazon FBA book arbitrage model.

## Core Concepts
- **Opportunity** — A specific arbitrage find: what to buy, where, at what price, and where to sell it for more. Includes estimated profit, fees, confidence score, and risk notes.
- **Agent Run** — A single execution of an agent. Has a status (running/completed/failed), token usage, tool calls made, and opportunities found.
- **Agent Config** — User-tunable parameters per agent: search categories, min profit threshold, geographic region, risk tolerance.
- **Confidence Score** — 0–100 rating on how reliable the opportunity is. Based on price data freshness, source reliability, and market volatility. Decays over time as opportunities go stale.
- **Watchlist** — Saved opportunities the user wants to track. Agents periodically re-check prices and alert on spread changes or expiring listings.

## Features

### Core
- Deploy and configure individual agents per arbitrage category
- Per-agent dedicated tab with tailored opportunity feed, filters, and controls
- Real-time opportunity streaming via SSE when agents are running
- Opportunity detail with full agent reasoning chain, fee breakdown, and risk notes
- Opportunity lifecycle: new → saved/dismissed → acted
- Quick actions: "Open Buy Link" and "Open Sell Listing Template" on every opportunity

### Intelligence
- Agent reasoning transparency — full chain of thought shown to user
- Confidence scoring with automatic decay over time (stale = lower confidence)
- Price history sparklines on opportunities showing recent price movement
- Risk notes surfaced prominently — condition unknowns, listing age, market volatility

### Tracking & Analytics
- Agent cost tracker — token spend per run, cost vs. estimated profit found (ROI)
- Profit tracker — when user marks "acted", input actual buy/sell prices, track real P&L over time
- Analytics dashboard — total estimated profit, opportunities by agent type, confidence distribution, profit over time
- Per-agent analytics within each agent's tab

### Scheduling & Automation
- Scheduled runs — daily/hourly per agent, configurable
- Morning briefing — summary of overnight agent findings
- Watchlist monitoring — agents re-check saved opportunities for price changes

### UX & Convenience
- Category presets — pre-built agent configs ("Electronics Flipper", "Sneaker Drops", "Crypto Spread Scanner", etc.)
- Opportunity sharing — generate a public shareable link to a specific opportunity snapshot
- Empty states with personality ("Your agents are sleeping. Wake them up?")
- Skeleton loaders and optimistic UI updates

### Future / Stretch
- Multi-agent coordination — agents share context across categories
- Browser extension — overlay on marketplace sites showing estimated resale value
- Mobile push notifications for high-confidence opportunities

## Tech Stack (Minimal Dependencies)
- **Framework:** Next.js 15+ (App Router, Server Components, Server Actions)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (CSS animations only — no Framer Motion)
- **UI Components:** Custom-built (no shadcn/ui or component libraries)
- **Database:** PostgreSQL (Neon serverless driver — `@neondatabase/serverless`) with raw SQL
- **Auth:** NextAuth.js (next-auth)
- **AI:** Raw fetch to Anthropic Claude API (no AI SDK). Custom tool-use loop.
- **Job Scheduling:** Next.js API routes + in-process scheduling (no BullMQ/Redis)
- **Search/Scraping:** Tavily API for search, fetch + LLM for extraction
- **Real-time:** Server-Sent Events (SSE) via native Web APIs

### Dependency Philosophy
Avoid 3rd party packages whenever possible. Use built-in Web APIs, Next.js features, and raw implementations over libraries. Every dependency must justify its existence.

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login, signup pages
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/        # Authenticated app
│   │   ├── layout.tsx      # Dashboard shell — sidebar + topbar + agent tab bar
│   │   ├── page.tsx        # Dashboard home — cross-agent summary, recent opps
│   │   ├── agents/
│   │   │   ├── listings/   # Listings Agent tab
│   │   │   ├── auctions/   # Auction Agent tab
│   │   │   ├── crypto/     # Crypto Agent tab
│   │   │   ├── retail/     # Retail Agent tab
│   │   │   ├── tickets/    # Tickets Agent tab
│   │   │   ├── collectibles/ # Collectibles Agent tab
│   │   │   └── books/      # Books/Media Agent tab
│   │   ├── opportunities/
│   │   │   └── [id]/       # Single opportunity detail (shared across agents)
│   │   ├── analytics/      # Global analytics across all agents
│   │   ├── watchlist/      # Saved opportunities being tracked
│   │   └── settings/       # Account, API keys, schedules, preferences
│   ├── api/
│   │   ├── agents/         # CRUD + run triggers
│   │   ├── opportunities/  # Fetch, filter, update status, share
│   │   ├── stream/         # SSE endpoint for live agent updates
│   │   ├── watchlist/      # Watchlist CRUD + re-check triggers
│   │   └── auth/           # NextAuth route handlers
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # Custom UI primitives (button, card, badge, input, modal, tabs, etc.)
│   ├── agents/             # Agent cards, status indicators, config forms, run controls
│   ├── opportunities/      # Opportunity cards, feed, detail breakdown, share modal
│   ├── dashboard/          # Sidebar, topbar, agent tab bar, stats cards
│   └── shared/             # Empty states, skeletons, price display, sparklines, confidence bar
├── agents/                 # Agent definitions + tool implementations
│   ├── base-agent.ts       # Custom tool-use loop calling Claude API
│   ├── listings-agent.ts
│   ├── auction-agent.ts
│   ├── crypto-agent.ts
│   ├── retail-agent.ts
│   ├── tickets-agent.ts
│   ├── collectibles-agent.ts
│   ├── books-agent.ts
│   └── tools/              # search-web, scrape-listing, compare-prices, calculate-fees, etc.
├── lib/
│   ├── db.ts               # Neon client + raw SQL query helpers
│   ├── auth.ts             # NextAuth config
│   ├── claude.ts           # Claude API client (raw fetch)
│   ├── scheduler.ts        # In-process scheduled run manager
│   └── utils.ts            # Shared utilities (formatting, calculations)
├── hooks/                  # React hooks (useAgentStatus, useOpportunityStream, useWatchlist)
├── types/                  # TypeScript types
└── db/
    └── migrations/         # Numbered SQL migration files
```

## UI Architecture

### Navigation Model
The app uses a **sidebar + tab bar** pattern:
- **Sidebar** (left): Home, Analytics, Watchlist, Settings — global sections
- **Agent Tab Bar** (top of main content): Horizontal tabs for each agent category — Listings, Auctions, Crypto, Retail, Tickets, Collectibles, Books
- Each agent tab is a self-contained section with its own opportunity feed, agent controls, config, and per-agent stats

### Per-Agent Tab Layout
Each agent tab contains three sub-sections (toggled via secondary navigation or scrollable single page):
1. **Feed** — Opportunity cards specific to this agent, filterable by confidence, profit, recency
2. **Controls** — Agent status (idle/running/scheduled), Run Now button, config form (categories, min profit, region, etc.), schedule settings
3. **Stats** — Per-agent analytics: runs today, opps found, estimated profit, cost per run, success rate

### Dashboard Home
Cross-agent summary view:
- Stat cards: total new opps, total estimated profit, agents running, top opportunity
- Recent opportunities across all agents (mixed feed, sortable)
- Agent status grid — at-a-glance health of all 7 agents

## Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:migrate   # Run SQL migrations
```

## Design System
- **Dark mode first** — near-black bg (#0a0a0f), card surfaces (#141419), subtle borders (#1f2028)
- **Accent:** Vibrant teal (#00d4aa)
- **Secondary accents:** Amber for warnings (#f59e0b), Red for losses (#ef4444), Green for profit (#22c55e)
- **Agent colors:** Each agent type gets a subtle color identity used in its tab icon and card accents
- **Fonts:** Inter/Geist for UI, JetBrains Mono for numbers/prices
- **Aesthetic:** Linear/Raycast-inspired — clean, sharp, subtle animations, not corporate
- **Animations:** CSS transitions and @keyframes only (no animation libraries)
- **Cards:** Subtle gradient borders on hover, glass-morphism-lite (no heavy blur)
- **Data density:** Show useful info at a glance — sparklines, inline badges, compact tables
- **Tab bar:** Horizontal scrollable with agent icons + labels, active tab has teal underline + glow

## Database Schema (Core Tables)
```sql
users, accounts, sessions          -- NextAuth managed
agents                             -- id, user_id, type, name, config (jsonb), status, schedule (jsonb), created_at
agent_runs                         -- id, agent_id, status, started_at, completed_at, tokens_used, tool_calls, error
opportunities                      -- id, agent_run_id, agent_type, user_id, title, description, buy_price, buy_source, buy_url, sell_price, sell_source, sell_url, estimated_profit, fees (jsonb), confidence, risk_notes, reasoning, status (new/saved/dismissed/acted), actual_buy_price, actual_sell_price, created_at, expires_at
watchlist                          -- id, user_id, opportunity_id, last_checked_at, price_change (jsonb), alert_sent
analytics_snapshots                -- id, user_id, date, total_opportunities, total_estimated_profit, by_agent_type (jsonb)
shared_opportunities               -- id, opportunity_id, share_token, created_at, expires_at
```

## Conventions
- Follow existing code style and patterns
- Keep functions small and focused
- Use Server Components by default, Client Components only when needed
- Use Server Actions for mutations
- Minimize external dependencies — prefer built-in APIs and hand-rolled solutions
- Agent tools are pure functions where possible (no LLM for fee calculations)
- Token/tool-call budgets on every agent run to control costs
- Always show agent reasoning and risks to the user for transparency
- Raw SQL over ORMs — keep queries explicit and visible
- Opportunity status flow: new → saved/dismissed → acted
- All money values stored as integers (cents) to avoid floating point issues
- Each agent tab is a self-contained route under /agents/{type}
- Shared opportunity detail page at /opportunities/[id] works across all agent types
