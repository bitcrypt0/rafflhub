#!/bin/bash
# Manual indexer trigger script
# Usage: ./trigger-indexer.sh <pool_address>

POOL_ADDRESS=$1
CHAIN_ID=84532
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhbnVoY3VzZmJ5cmNtbnV3d3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDMxODksImV4cCI6MjA4NTU3OTE4OX0.kSXj6xmnM9fHf9szslxP1kd1x5p6qYWC76JFd_BstBQ"

if [ -z "$POOL_ADDRESS" ]; then
  echo "Usage: ./trigger-indexer.sh <pool_address>"
  echo "Example: ./trigger-indexer.sh 0x1234..."
  exit 1
fi

echo "🔄 Triggering indexer for pool: $POOL_ADDRESS"
echo ""

# Index PoolDeployer (to find the pool)
echo "📡 Step 1: Indexing PoolDeployer..."
curl -X POST https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-deployer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{\"chainId\": $CHAIN_ID}"

echo ""
echo ""

# Index Pool Events
echo "📡 Step 2: Indexing Pool Events..."
curl -X POST https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/index-pool-events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{\"chainId\": $CHAIN_ID, \"poolAddress\": \"$POOL_ADDRESS\"}"

echo ""
echo ""
echo "✅ Indexing complete!"
echo "Check the API: https://xanuhcusfbyrcmnuwwys.supabase.co/functions/v1/api-pools?chainId=$CHAIN_ID"
