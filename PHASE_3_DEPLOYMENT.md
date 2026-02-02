# Phase 3: Extended Indexers - Deployment Guide

**Created:** February 2, 2026
**Status:** Ready to Deploy

## 📦 What Was Created

Four new Edge Functions for Phase 3:

### 1. `index-nft-factory`
**Purpose:** Monitors NFT collection deployments
**Events:** `CollectionCreated`
**Updates:** `collections` table, `user_activity` (collection_created)

### 2. `index-collection-events`
**Purpose:** Monitors NFT collection events
**Events:** `Revealed`, `Transfer` (mints), `VestingScheduleSet`
**Updates:** `collections` table, `user_activity` (collection_revealed, nft_minted, vesting_scheduled)

### 3. `index-rewards`
**Purpose:** Tracks reward claims from RewardsFlywheel
**Events:** `RewardsClaimed`
**Updates:** `rewards_claims` table, `user_activity` (rewards_claimed)

### 4. `fetch-nft-metadata`
**Purpose:** Fetches and caches NFT metadata from IPFS/Arweave
**Features:**
- Multiple IPFS gateway fallbacks
- Automatic retry logic
- Batch processing (up to 50 tokens per call)
- Image URL resolution
**Updates:** `nft_metadata_cache` table

---

## 🚀 Deployment Steps

### Step 1: Log in to Supabase CLI

```bash
supabase login
```

You'll be prompted to authenticate via browser.

### Step 2: Deploy Edge Functions

Deploy each function individually:

```bash
# Deploy NFT Factory indexer
supabase functions deploy index-nft-factory

# Deploy Collection Events indexer
supabase functions deploy index-collection-events

# Deploy Rewards indexer
supabase functions deploy index-rewards

# Deploy NFT Metadata fetcher
supabase functions deploy fetch-nft-metadata
```

### Step 3: Verify Deployment

Check that functions are live:

```bash
supabase functions list
```

You should see all 7 functions:
- ✅ index-pool-deployer (Phase 2)
- ✅ index-pool-events (Phase 2)
- ✅ index-nft-factory (Phase 3)
- ✅ index-collection-events (Phase 3)
- ✅ index-rewards (Phase 3)
- ✅ fetch-nft-metadata (Phase 3)

---

## 🧪 Testing

### Test NFT Factory Indexer

```bash
curl -X POST "https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-nft-factory" \
  -H "Content-Type: application/json" \
  -d '{"chainId": 84532}'
```

**Expected Response:**
```json
{
  "success": true,
  "chainId": 84532,
  "eventsFound": 0,
  "recordsProcessed": { "success": 0, "errors": 0 }
}
```

### Test Rewards Indexer

```bash
curl -X POST "https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-rewards" \
  -H "Content-Type: application/json" \
  -d '{"chainId": 84532}'
```

### Test Metadata Fetcher

Once you have a collection deployed:

```bash
curl -X POST "https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/fetch-nft-metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 84532,
    "collectionAddress": "0xYOUR_COLLECTION_ADDRESS",
    "maxTokens": 10
  }'
```

---

## 🔄 Automatic Scheduling

The GitHub Actions workflow has been updated to call:
- ✅ `index-pool-deployer` (every 5 minutes)
- ✅ `index-pool-events` (every 5 minutes)
- ✅ `index-nft-factory` (every 5 minutes)
- ✅ `index-rewards` (every 5 minutes)

**Note:** `index-collection-events` and `fetch-nft-metadata` are NOT in the workflow because:
- **Collection Events:** Need specific collection addresses (add manually when collections are deployed)
- **Metadata Fetcher:** Should be called on-demand when metadata is needed (expensive operation)

### How to Add Collection Indexing

When you deploy an NFT collection, add it to the workflow:

```yaml
- name: Index Collection Events
  run: |
    response=$(curl -s -X POST https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-collection-events \
      -H "Content-Type: application/json" \
      -d '{"chainId": 84532, "collectionAddress": "0xYOUR_COLLECTION_ADDRESS"}')
    echo "Collection events response: $response"
```

---

## 📊 Database Verification

After deployment and first run, verify data in Supabase Dashboard:

### Check Collections Table
```sql
SELECT * FROM collections WHERE chain_id = 84532;
```

### Check Rewards Claims
```sql
SELECT * FROM rewards_claims WHERE chain_id = 84532;
```

### Check NFT Metadata Cache
```sql
SELECT * FROM nft_metadata_cache WHERE chain_id = 84532;
```

### Check User Activity
```sql
SELECT * FROM user_activity
WHERE activity_type IN ('collection_created', 'collection_revealed', 'nft_minted', 'rewards_claimed')
ORDER BY timestamp DESC;
```

---

## 🎯 What's Next

After deploying Phase 3, the next steps are:

### Phase 4: API Layer
Create REST endpoints:
- `api-pools` - Pool data queries
- `api-user` - User activity and stats
- `api-collections` - NFT collection data
- `api-metadata` - Cached artwork
- `api-stats` - Platform statistics

### Phase 5: Frontend Integration
- Create `supabasePoolService.js`
- Update `RaffleService.js` with Supabase fallback
- Add real-time subscriptions to hooks
- Update components to use cached data

---

## 🐛 Troubleshooting

### "Access token not provided"
Run `supabase login` again.

### "No NFTFactory contract deployed on chain X"
Only Base Sepolia (84532) has contracts deployed. Deploy contracts to other chains first.

### "Collection not found in database"
Run `index-nft-factory` before running `index-collection-events` or `fetch-nft-metadata`.

### "Failed to fetch metadata from all gateways"
IPFS gateways might be slow. The function retries automatically with 4 different gateways. If all fail, the metadata might not be pinned properly.

---

## 📈 Impact

Phase 3 adds:
- ✅ NFT collection tracking (creation, reveals, mints)
- ✅ Rewards flywheel monitoring
- ✅ IPFS/Arweave metadata caching
- ✅ Rich user activity feed (8 event types total)

**Performance Benefits:**
- Zero IPFS lookups on frontend (all cached)
- NFT artwork loads instantly
- Complete user activity history
- Rewards claims tracked automatically
