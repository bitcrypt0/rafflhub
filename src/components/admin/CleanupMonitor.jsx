import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { RefreshCw, Trash2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { toast } from '../ui/sonner';

const CleanupMonitor = () => {
  const [cleanupLogs, setCleanupLogs] = useState([]);
  const [cleanupStats, setCleanupStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningCleanup, setRunningCleanup] = useState(false);

  useEffect(() => {
    fetchCleanupData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchCleanupData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchCleanupData = async () => {
    try {
      // Fetch recent cleanup logs
      const { data: logs, error: logsError } = await supabase
        .from('cleanup_monitoring')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(10);

      if (logsError) throw logsError;
      setCleanupLogs(logs || []);

      // Fetch current cleanup statistics
      const { data: stats, error: statsError } = await supabase
        .rpc('get_cleanup_stats');

      if (statsError) throw statsError;
      setCleanupStats(stats?.[0] || null);

    } catch (error) {
      console.error('Error fetching cleanup data:', error);
      toast.error('Failed to load cleanup data');
    } finally {
      setLoading(false);
    }
  };

  const runManualCleanup = async () => {
    setRunningCleanup(true);
    try {
      const { data, error } = await supabase.rpc('manual_cleanup');

      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        toast.success(result.message);
        await fetchCleanupData(); // Refresh data
      }
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast.error('Failed to run cleanup: ' + error.message);
    } finally {
      setRunningCleanup(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading cleanup data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Database Cleanup Monitor</h2>
          <p className="text-sm text-gray-600 mt-1">
            Automated cleanup of expired records and monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchCleanupData}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={runManualCleanup}
            disabled={runningCleanup}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Trash2 className={`w-4 h-4 ${runningCleanup ? 'animate-pulse' : ''}`} />
            {runningCleanup ? 'Running...' : 'Run Cleanup Now'}
          </button>
        </div>
      </div>

      {/* Current Statistics */}
      {cleanupStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Expired Signatures"
            value={cleanupStats.expired_signatures_count}
            icon={<AlertCircle className="w-5 h-5 text-orange-500" />}
            color="orange"
          />
          <StatCard
            title="Stale Nonces"
            value={cleanupStats.stale_nonces_count}
            icon={<Clock className="w-5 h-5 text-blue-500" />}
            color="blue"
          />
          <StatCard
            title="Old Verifications"
            value={cleanupStats.old_verifications_count}
            icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            color="green"
          />
          <StatCard
            title="Total Cleanable"
            value={cleanupStats.total_cleanable_records}
            icon={<Trash2 className="w-5 h-5 text-red-500" />}
            color="red"
          />
        </div>
      )}

      {/* Cleanup History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Cleanup History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Executed At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signatures
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nonces
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verifications
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cleanupLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    No cleanup history available
                  </td>
                </tr>
              ) : (
                cleanupLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(log.executed_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        log.cleanup_type === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        log.cleanup_type === 'manual' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.cleanup_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.signatures_deleted || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.nonces_deleted || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.verifications_deleted || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.total_deleted || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(log.execution_time_ms)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.error_message ? (
                        <span className="flex items-center text-red-600">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Error
                        </span>
                      ) : (
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Success
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Cleanup Schedule</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Hourly:</strong> Expired signatures (older than expires_at)</li>
          <li>• <strong>Daily (2 AM UTC):</strong> Stale nonces (inactive for 90+ days)</li>
          <li>• <strong>Weekly (Sunday 3 AM UTC):</strong> Old verifications (180+ days, completed only)</li>
        </ul>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    orange: 'bg-orange-50 border-orange-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200'
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value?.toLocaleString() || 0}</p>
        </div>
        {icon}
      </div>
    </div>
  );
};

export default CleanupMonitor;
