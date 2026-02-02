import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useRaffleSummariesEnhanced } from '../hooks/useRaffleSummariesEnhanced';
import { useProfileDataEnhanced } from '../hooks/useProfileDataEnhanced';
import { supabaseService } from '../services/supabaseService';

/**
 * Supabase Integration Test Component
 *
 * Tests all Phase 5 functionality:
 * - Supabase service initialization
 * - Enhanced raffle summaries hook
 * - Enhanced profile data hook
 * - Real-time subscriptions
 * - RPC fallback behavior
 */
export default function SupabaseIntegrationTest() {
  const { address, chainId, connected } = useWallet();
  const [supabaseStatus, setSupabaseStatus] = useState('checking...');
  const [testResults, setTestResults] = useState([]);

  // Test 1: Enhanced Raffle Summaries
  const {
    summaries,
    loading: raffleSummariesLoading,
    error: raffleSummariesError,
    dataSource: raffleSummariesSource,
    totalAvailable,
    refresh: refreshRaffles
  } = useRaffleSummariesEnhanced({
    initialCount: 5,
    state: null, // All states
    useRealtime: false // Disable for testing
  });

  // Test 2: Enhanced Profile Data (only if connected)
  const {
    activityStats,
    userActivity,
    loading: profileLoading,
    error: profileError,
    dataSource: profileSource,
    collectionsCreated,
    nftsMinted,
    rewardsClaimed,
    refresh: refreshProfile
  } = useProfileDataEnhanced({
    useRealtime: false // Disable for testing
  });

  // Check Supabase initialization status
  useEffect(() => {
    const initialized = supabaseService.initialize();
    setSupabaseStatus(initialized ? '✅ Connected' : '❌ Failed to initialize');

    // Add test result
    addTestResult('Supabase Service Initialization', initialized,
      initialized ? 'Supabase client initialized successfully' : 'Failed to initialize Supabase client'
    );
  }, []);

  // Test raffle summaries data source
  useEffect(() => {
    if (!raffleSummariesLoading && raffleSummariesSource) {
      const isSupabase = raffleSummariesSource === 'supabase';
      addTestResult(
        'Raffle Summaries Data Source',
        isSupabase,
        isSupabase
          ? `Using Supabase (fast mode) - Loaded ${summaries.length} pools`
          : `Using RPC fallback (slow mode) - Loaded ${summaries.length} pools`
      );
    }
  }, [raffleSummariesLoading, raffleSummariesSource, summaries.length]);

  // Test profile data source (only if connected)
  useEffect(() => {
    if (connected && !profileLoading && profileSource) {
      const isSupabase = profileSource === 'supabase';
      addTestResult(
        'Profile Data Source',
        isSupabase,
        isSupabase
          ? `Using Supabase (fast mode) - Loaded user data`
          : `Using RPC fallback (slow mode) - Loaded user data`
      );
    }
  }, [connected, profileLoading, profileSource]);

  // Helper to add test results
  const addTestResult = (testName, passed, message) => {
    setTestResults(prev => {
      // Avoid duplicates
      const exists = prev.find(r => r.testName === testName);
      if (exists) return prev;

      return [...prev, {
        testName,
        passed,
        message,
        timestamp: new Date().toISOString()
      }];
    });
  };

  // Test direct API calls
  const testDirectAPIs = async () => {
    addTestResult('Testing Direct APIs', true, 'Starting direct API tests...');

    try {
      // Test stats API
      const stats = await supabaseService.getStats(chainId || 84532);
      addTestResult(
        'Stats API',
        stats && stats.success,
        stats ? `Total pools: ${stats.stats?.pools?.total || 0}, Total volume: ${stats.stats?.pools?.totalVolume || 0}` : 'Failed to fetch stats'
      );

      // Test pools API
      const pools = await supabaseService.getPools({ chainId: chainId || 84532, limit: 3 });
      addTestResult(
        'Pools API',
        pools && pools.success,
        pools ? `Retrieved ${pools.pools?.length || 0} pools` : 'Failed to fetch pools'
      );

      // Test user API (if connected)
      if (address) {
        const profile = await supabaseService.getUserProfile(address, chainId);
        addTestResult(
          'User Profile API',
          profile && profile.success,
          profile ? `User stats: ${profile.stats?.pools?.created || 0} pools created, ${profile.stats?.pools?.participated || 0} participated` : 'Failed to fetch profile'
        );
      }
    } catch (err) {
      addTestResult('Direct API Tests', false, `Error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        🧪 Supabase Integration Test Suite
      </h1>

      {/* Status Overview */}
      <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>📊 Status Overview</h2>
        <p><strong>Supabase Status:</strong> {supabaseStatus}</p>
        <p><strong>Wallet Connected:</strong> {connected ? `✅ ${address?.slice(0, 10)}...` : '❌ Not connected'}</p>
        <p><strong>Chain ID:</strong> {chainId || 'Not connected'}</p>
        <p><strong>Tests Run:</strong> {testResults.length}</p>
        <p><strong>Tests Passed:</strong> {testResults.filter(r => r.passed).length} / {testResults.length}</p>
      </div>

      {/* Test Results */}
      <div style={{ marginBottom: '20px' }}>
        <h2>✅ Test Results</h2>
        {testResults.length === 0 ? (
          <p style={{ color: '#888' }}>Running tests...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#333', color: 'white' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Test</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {testResults.map((result, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd', background: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                  <td style={{ padding: '10px' }}>{result.testName}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ color: result.passed ? 'green' : 'orange' }}>
                      {result.passed ? '✅ PASS' : '⚠️ FALLBACK'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', fontSize: '12px' }}>{result.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual Test Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <h2>🎮 Manual Tests</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={testDirectAPIs}
            style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Test Direct API Calls
          </button>
          <button
            onClick={refreshRaffles}
            style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Refresh Raffle Summaries
          </button>
          <button
            onClick={refreshProfile}
            disabled={!connected}
            style={{ padding: '10px 20px', background: connected ? '#ffc107' : '#ccc', color: 'white', border: 'none', borderRadius: '5px', cursor: connected ? 'pointer' : 'not-allowed' }}
          >
            Refresh Profile Data
          </button>
          <button
            onClick={() => {
              supabaseService.clearCache();
              addTestResult('Cache Clear', true, 'All caches cleared');
            }}
            style={{ padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Clear Cache
          </button>
        </div>
      </div>

      {/* Raffle Summaries Data */}
      <div style={{ marginBottom: '20px' }}>
        <h2>🎲 Raffle Summaries Hook Test</h2>
        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
          <p><strong>Loading:</strong> {raffleSummariesLoading ? '⏳ Yes' : '✅ No'}</p>
          <p><strong>Data Source:</strong> {raffleSummariesSource || 'N/A'}</p>
          <p><strong>Pools Loaded:</strong> {summaries.length}</p>
          <p><strong>Total Available:</strong> {totalAvailable || 'N/A'}</p>
          <p><strong>Error:</strong> {raffleSummariesError || 'None'}</p>

          {summaries.length > 0 && (
            <>
              <h3>Sample Pools:</h3>
              <ul style={{ fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                {summaries.slice(0, 3).map(pool => (
                  <li key={pool.address} style={{ marginBottom: '10px' }}>
                    <strong>{pool.name}</strong> ({pool.address.slice(0, 10)}...)<br />
                    State: {pool.stateNum} | Slots: {pool.slotsSold || 0}/{pool.ticketLimit}<br />
                    Fee: {pool.slotFee} ETH
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Profile Data */}
      {connected && (
        <div style={{ marginBottom: '20px' }}>
          <h2>👤 Profile Data Hook Test</h2>
          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
            <p><strong>Loading:</strong> {profileLoading ? '⏳ Yes' : '✅ No'}</p>
            <p><strong>Data Source:</strong> {profileSource || 'N/A'}</p>
            <p><strong>Error:</strong> {profileError || 'None'}</p>

            {activityStats && (
              <>
                <h3>Activity Stats:</h3>
                <ul style={{ fontSize: '12px' }}>
                  <li>Raffles Created: {activityStats.totalRafflesCreated || 0}</li>
                  <li>Tickets Purchased: {activityStats.totalTicketsPurchased || 0}</li>
                  <li>Prizes Won: {activityStats.totalPrizesWon || 0}</li>
                  <li>Collections Created: {collectionsCreated || 0}</li>
                  <li>NFTs Minted: {nftsMinted || 0}</li>
                  <li>Rewards Claimed: {rewardsClaimed || 0}</li>
                </ul>
              </>
            )}

            {userActivity && userActivity.length > 0 && (
              <>
                <h3>Recent Activity ({userActivity.length} items):</h3>
                <ul style={{ fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                  {userActivity.slice(0, 5).map((activity, idx) => (
                    <li key={activity.id || idx} style={{ marginBottom: '5px' }}>
                      {activity.type} - {new Date(activity.timestamp).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ background: '#e7f3ff', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>📝 Test Instructions:</h3>
        <ol style={{ fontSize: '14px' }}>
          <li>Check that "Supabase Status" shows "✅ Connected"</li>
          <li>Verify "Raffle Summaries Data Source" shows "supabase" (not "rpc")</li>
          <li>If connected, verify "Profile Data Source" shows "supabase"</li>
          <li>Click "Test Direct API Calls" to test all API endpoints</li>
          <li>All tests should show "✅ PASS" (⚠️ FALLBACK is acceptable but slower)</li>
          <li>Check that pools are loaded (should see sample pools below)</li>
          <li>If wallet connected, check that profile stats are populated</li>
        </ol>

        <h3>✅ Expected Results:</h3>
        <ul style={{ fontSize: '14px' }}>
          <li>All data sources should be "supabase" (not "rpc")</li>
          <li>Loading should complete in &lt;500ms (check Network tab)</li>
          <li>Pool data and user data should be displayed</li>
          <li>No errors in console</li>
        </ul>
      </div>
    </div>
  );
}
