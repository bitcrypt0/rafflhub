@echo off
REM Trigger the pool indexer using curl

set SUPABASE_URL=https://xanuhcusfbyrcmnuwwys.supabase.co
set SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhbnVoY3VzZmJ5cmNtbnV3d3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAwMzE4OSwiZXhwIjoyMDg1NTc5MTg5fQ.uVVzOEdQNkf0k2b-IV33UTK5DAYOtZ_HFV6P1P3UiCg

echo Triggering indexer for chain 84532...
curl -X POST "%SUPABASE_URL%/functions/v1/index-pool-deployer" ^
  -H "Authorization: Bearer %SERVICE_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"chainId\": 84532, \"fromBlock\": 0, \"toBlock\": \"latest\"}"

echo.
echo Done!
pause
