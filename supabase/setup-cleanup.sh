#!/bin/bash

# Database Cleanup System Setup Script
# This script automates the setup of the database cleanup system

set -e

echo "🧹 Setting up Database Cleanup System..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Please install it first:${NC}"
    echo "   npm install -g supabase"
    exit 1
fi

echo -e "${BLUE}Step 1: Running database migration...${NC}"
supabase db push
echo -e "${GREEN}✅ Database migration completed${NC}"
echo ""

echo -e "${BLUE}Step 2: Deploying cleanup edge function...${NC}"
supabase functions deploy cleanup-expired-records
echo -e "${GREEN}✅ Edge function deployed${NC}"
echo ""

echo -e "${BLUE}Step 3: Setting up environment variables...${NC}"
echo -e "${YELLOW}Please set the following secrets:${NC}"
echo ""
echo "  supabase secrets set CRON_SECRET=<your-secret-key>"
echo ""
echo -e "${YELLOW}Note: Generate a secure random string for CRON_SECRET${NC}"
echo ""

echo -e "${BLUE}Step 4: Configuring cron jobs...${NC}"
echo -e "${YELLOW}You need to manually configure cron jobs in Supabase Dashboard:${NC}"
echo ""
echo "1. Go to Database → Cron Jobs"
echo "2. Create job with schedule: 0 * * * *"
echo "3. Use this SQL command:"
echo ""
echo "   SELECT net.http_post("
echo "     url := 'https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-expired-records',"
echo "     headers := '{\"Authorization\": \"Bearer YOUR_ANON_KEY\", \"x-supabase-cron\": \"true\"}'::jsonb"
echo "   );"
echo ""

echo -e "${BLUE}Step 5: Testing cleanup function...${NC}"
echo "Running manual cleanup test..."
echo ""

# Test the cleanup function
RESPONSE=$(supabase functions invoke cleanup-expired-records --no-verify-jwt 2>&1 || true)
echo "$RESPONSE"
echo ""

echo -e "${GREEN}✅ Setup completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Configure cron jobs in Supabase Dashboard"
echo "2. Set CRON_SECRET environment variable"
echo "3. Add CleanupMonitor component to your admin panel"
echo "4. Monitor first cleanup execution"
echo ""
echo -e "${BLUE}Documentation:${NC} See DATABASE_CLEANUP_SYSTEM.md for details"
echo ""
