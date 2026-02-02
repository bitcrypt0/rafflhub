# Backend Infrastructure Requirements

This document outlines what you (the overseer) need to set up before implementation begins.

---

## 1. Supabase Project Configuration

You already have a Supabase project set up. The following features need to be enabled or verified:

### Required Supabase Features
| Feature | Status | Action Needed |
|---------|--------|---------------|
| PostgreSQL Database | Already have | None |
| Edge Functions | Already have | None |
| Real-time | Already enabled | None |
| pg_cron extension | Need to verify | Enable in dashboard |
| pg_net extension | Need to verify | Enable in dashboard |

### How to Enable Extensions
1. Go to your Supabase Dashboard
2. Navigate to **Database** > **Extensions**
3. Search for and enable:
   - `pg_cron` - For scheduled tasks (indexer runs every 30 seconds)
   - `pg_net` - For making HTTP calls from database

---

## 2. Environment Variables

### Edge Functions Secrets
You'll need to add RPC URLs for each blockchain network you want to support. These go in the Supabase Dashboard under **Edge Functions** > **Secrets**.

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `RPC_URL_84532` | Base Sepolia RPC | Already have public RPC |
| `RPC_URL_8453` | Base Mainnet RPC | Get from Alchemy/Infura |
| `RPC_URL_1` | Ethereum Mainnet RPC | Get from Alchemy/Infura |
| `RPC_URL_42161` | Arbitrum One RPC | Get from Alchemy/Infura |
| ... | (one per chain) | |

**Free RPC Options:**
- Public RPCs (already configured) - Lower rate limits
- [Alchemy](https://www.alchemy.com/) - Free tier: 300M compute units/month
- [Infura](https://www.infura.io/) - Free tier: 100K requests/day
- [QuickNode](https://www.quicknode.com/) - Free tier available

**Recommended:** Get Alchemy or Infura API keys for production to avoid rate limiting.

### Frontend Environment Variables
Already configured in your `.env` file:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

---

## 3. Contract Addresses

You need to provide deployed contract addresses for each chain. Currently only Base Sepolia has contracts deployed.

### Current Deployment Status
| Chain | Contracts Deployed? |
|-------|---------------------|
| Base Sepolia (84532) | Yes |
| Base Mainnet (8453) | No |
| Ethereum (1) | No |
| Arbitrum (42161) | No |
| Optimism (10) | No |
| BNB Chain (56) | No |

**Action:** Before deploying the backend for a new chain, you must first deploy the smart contracts to that chain and update `src/networks.js` with the new addresses.

---

## 4. Estimated Costs

### Supabase (Your Current Plan)
- **Free tier** includes:
  - 500MB database storage
  - 1GB file storage
  - 2M Edge Function invocations/month
  - 50MB Edge Function bandwidth

- **If you exceed limits**, Pro plan is $25/month with:
  - 8GB database storage
  - 100GB file storage
  - 2M+ function invocations

### RPC Providers
- **Free tiers** are sufficient for development and low-moderate traffic
- **Paid tiers** ($49-$199/month) needed for high traffic (1000+ users/day)

### Total Estimated Monthly Cost
| Usage Level | Cost |
|-------------|------|
| Development/Testing | $0 |
| Low traffic (< 100 users/day) | $0 - $25 |
| Medium traffic (100-1000 users/day) | $25 - $75 |
| High traffic (1000+ users/day) | $75 - $200 |

---

## 5. Security Considerations

### API Keys to Protect
| Key | Where It's Used | Who Can See It |
|-----|-----------------|----------------|
| Supabase Anon Key | Frontend | Public (safe) |
| Supabase Service Role Key | Edge Functions only | Never expose publicly |
| RPC API Keys | Edge Functions only | Never expose publicly |

**Important:** The Service Role Key has full database access. Never commit it to git or expose it in frontend code.

### Rate Limiting
The backend will implement rate limiting to prevent abuse:
- 100 requests/minute per IP for pool queries
- 50 requests/minute per IP for user queries

---

## 6. Monitoring & Alerts

### What Gets Monitored
1. **Indexer Health** - Is the indexer running and keeping up?
2. **API Response Times** - Are queries fast enough?
3. **Error Rates** - Are there failures happening?

### Where to Check
- **Supabase Dashboard** > **Edge Functions** > **Logs**
- **Supabase Dashboard** > **Database** > **Query Performance**
- Health endpoint: `https://your-project.supabase.co/functions/v1/health`

---

## 7. Deployment Checklist

Before going live, ensure:

- [ ] pg_cron and pg_net extensions are enabled
- [ ] RPC URLs are set as Edge Function secrets
- [ ] All smart contracts are deployed on target chains
- [ ] Network config updated with contract addresses
- [ ] Database migrations have been run
- [ ] Health endpoint returns "healthy" status
- [ ] Frontend can fetch data from new API endpoints
- [ ] Real-time subscriptions are working

---

## 8. Configuration Decisions (Confirmed)

Based on your input, here are the confirmed configuration choices:

| Decision | Your Choice |
|----------|-------------|
| **Target Chains** | All chains where contracts are deployed (auto-detect) |
| **Historical Backfill** | No - start fresh from current block |
| **RPC Provider** | Free public RPCs (can upgrade later if needed) |
| **Monitoring** | Basic /health endpoint only |

These choices mean:
- The indexer will automatically support any chain with deployed contracts
- Existing pools won't appear in cache until they emit new events (new ticket purchases, etc.)
- No upfront RPC provider costs - upgrade to Alchemy/Infura if you hit rate limits
- Simple monitoring - check `/health` endpoint when needed

---

## 9. Timeline Estimate

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Database Setup | 2-3 days | New tables, indexes, RLS policies |
| Core Indexer | 4-5 days | Pool events indexed and stored |
| Extended Indexer | 3-4 days | NFT, rewards events indexed |
| API Layer | 3-4 days | REST endpoints for frontend |
| Frontend Integration | 4-5 days | Modified services, real-time updates |
| Testing & Polish | 3-4 days | Bug fixes, performance optimization |
| **Total** | **~4-5 weeks** | Complete backend infrastructure |

---

## 10. Support Contacts

If you need help with:
- **Supabase issues**: [Supabase Support](https://supabase.com/support)
- **RPC providers**: Check their respective documentation
- **Smart contract questions**: Your Solidity developer

---

## Summary of What You Need to Do

1. **Enable Supabase extensions** (pg_cron, pg_net) - 5 minutes
2. **Get RPC API keys** (Alchemy or Infura) - 10 minutes
3. **Deploy contracts** to production chains - Whenever ready
4. **Answer the questions** in Section 8 - Before implementation starts
