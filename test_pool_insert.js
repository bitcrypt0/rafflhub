// Test script to identify the exact database error when inserting a pool
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test data matching what the indexer would insert
const testPoolData = {
  address: '0x6213dd2ce5d8d2c9d98ed2792cf1e8734ff6ba13',
  chain_id: 84532,
  name: 'Doodles #50 Giveaway',
  creator: '0xb57d30f9582a5a0c4f90ad434e66dea156a040eb',
  start_time: 1738612800,
  duration: 604800,
  created_at_block: 37187114,
  created_at_timestamp: new Date(1770142516 * 1000).toISOString(),
  slot_fee: '0',
  slot_limit: 100,
  winners_count: 1,
  max_slots_per_address: 10,
  state: 1,
  is_prized: true,
  prize_collection: '0xd0ce5177ac031d337e352fe1253cc74c2a3d3081',
  prize_token_id: 50,
  standard: 0,
  is_collab_pool: false,
  uses_custom_fee: false,
  revenue_recipient: '0xb57d30f9582a5a0c4f90ad434e66dea156a040eb',
  is_external_collection: false,
  is_refundable: false,
  amount_per_winner: 1,
  erc20_prize_token: null,
  erc20_prize_amount: '0',
  native_prize_amount: '0',
  is_escrowed_prize: true,
  holder_token_address: null,
  holder_token_standard: null,
  min_holder_token_balance: null,
  erc20_prize_token_symbol: null,
  artwork_url: null,
  last_synced_block: 37187114,
  last_synced_at: new Date().toISOString(),
};

async function testInsert() {
  console.log('Testing pool insert with data:', JSON.stringify(testPoolData, null, 2));
  
  const { data, error } = await supabase
    .from('pools')
    .upsert(testPoolData, { onConflict: 'address,chain_id' });
  
  if (error) {
    console.error('\n❌ ERROR inserting pool:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error.details);
    console.error('Error hint:', error.hint);
    console.error('Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log('\n✅ Successfully inserted pool!');
    console.log('Data:', data);
  }
}

testInsert();
