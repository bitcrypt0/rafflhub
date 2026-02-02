# Automatic Indexing Setup Options

The `cron` schema error indicates pg_cron may have restrictions on Supabase's hosted platform.

## ✅ RECOMMENDED: Use Supabase Platform Webhooks

Supabase provides Database Webhooks that are more reliable than pg_cron:

### Setup Steps:

1. **Go to Database > Webhooks** in Supabase Dashboard:
   https://supabase.com/dashboard/project/xanuhcusfbyrcmnuwwys/database/hooks

2. **Create Webhook #1 - Pool Deployer Indexer**
   - **Name:** `index-pool-deployer-scheduler`
   - **Table:** `pools` (or any table - we just need a trigger)
   - **Events:** Leave unchecked (we'll use scheduled invocation)
   - **Type:** HTTP Request
   - **Method:** POST
   - **URL:** `https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-deployer`
   - **Headers:** `{"Content-Type": "application/json"}`
   - **Body:** `{"chainId": 84532}`

3. **Create Webhook #2 - Pool Events Indexer**
   - Similar setup but call `index-pool-events` for each pool

**Note:** Supabase webhooks are event-driven, not time-based. For time-based scheduling, use Option 2 below.

---

## ✅ OPTION 2: External Cron Service (EASIEST)

Use a free external service to call your Edge Functions every minute:

### A) GitHub Actions (Recommended - Free)

Create `.github/workflows/indexer.yml` in your frontend repository:

```yaml
name: Blockchain Indexer

on:
  schedule:
    - cron: '* * * * *'  # Every minute
  workflow_dispatch:  # Allow manual trigger

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - name: Index PoolDeployer
        run: |
          curl -X POST https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-deployer \
            -H "Content-Type: application/json" \
            -d '{"chainId": 84532}'

      - name: Index Pool Events
        run: |
          curl -X POST https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-events \
            -H "Content-Type: application/json" \
            -d '{"chainId": 84532, "poolAddress": "0x09988afeace77d9147b141fad522e43c9e8cbd0e"}'
```

**Pros:**
- ✅ Free (GitHub Actions minutes)
- ✅ Reliable
- ✅ Easy to monitor
- ✅ Version controlled

**Cons:**
- ⚠️ Minimum interval is 5 minutes (GitHub limitation)

---

### B) EasyCron (Free tier available)

1. Sign up at https://www.easycron.com
2. Create cron job:
   - **URL:** `https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-deployer`
   - **Method:** POST
   - **Body:** `{"chainId": 84532}`
   - **Schedule:** Every 1 minute

---

### C) cron-job.org (Free)

1. Sign up at https://cron-job.org
2. Create job calling your Edge Function
3. Set to run every minute

---

## ✅ OPTION 3: Try Enabling pg_cron (May Not Work)

Some Supabase projects support pg_cron, others don't. Try this:

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Then run setup-automatic-indexing-fixed.sql
```

If you still get "schema cron does not exist", pg_cron is not available on your plan.

---

## 🎯 RECOMMENDED APPROACH FOR NOW

**Quick Solution (Testing):**
Manually run the indexers when needed:

```bash
# Index new pools
curl -X POST "https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-deployer" \
  -H "Content-Type: application/json" \
  -d '{"chainId": 84532}'

# Index your pool events
curl -X POST "https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-events" \
  -H "Content-Type: application/json" \
  -d '{"chainId": 84532, "poolAddress": "0x09988afeace77d9147b141fad522e43c9e8cbd0e"}'
```

**Production Solution:**
Use **GitHub Actions** (Option 2A) - it's free, reliable, and easy to set up.

---

## 📝 Next Steps

1. **For Testing:** Use manual curl commands when you create new pools
2. **For Production:** Set up GitHub Actions workflow (5 minutes to configure)
3. **Alternative:** Use EasyCron or cron-job.org if you prefer web-based setup

**The core indexers are working perfectly** - you just need a reliable way to trigger them regularly! ✅

---

## 🔧 Quick Test

Verify your indexers work right now:

```bash
# This should return success with events found
curl -X POST "https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-events" \
  -H "Content-Type: application/json" \
  -d '{"chainId": 84532, "poolAddress": "0x09988afeace77d9147b141fad522e43c9e8cbd0e"}'
```

You should see: `"eventsProcessed": 1` (your slot purchase)
