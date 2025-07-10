import React, { useState, useEffect } from 'react';
import { Mail, Send, Users, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmailLog {
  id: string;
  user_id: string;
  pokemon_id: number;
  pokemon_name: string;
  email_sent_at: string;
  email_status: string;
  created_at: string;
}

interface EmailStats {
  total_sent: number;
  total_failed: number;
  users_with_notifications: number;
  recent_notifications: EmailLog[];
}

const EmailNotificationsManager: React.FC = () => {
  const [stats, setStats] = useState<EmailStats>({
    total_sent: 0,
    total_failed: 0,
    users_with_notifications: 0,
    recent_notifications: []
  });
  const [loading, setLoading] = useState(true);
  const [testPokemonId, setTestPokemonId] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchEmailStats();
  }, []);

  const fetchEmailStats = async () => {
    try {
      setLoading(true);

      // Получаем статистику отправленных писем
      const { count: totalSent } = await supabase
        .from('email_notifications_log')
        .select('*', { count: 'exact', head: true })
        .eq('email_status', 'sent');

      const { count: totalFailed } = await supabase
        .from('email_notifications_log')
        .select('*', { count: 'exact', head: true })
        .eq('email_status', 'failed');

      // Получаем количество пользователей с включенными уведомлениями
      const { count: usersWithNotifications } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('email_notifications', true)
        .not('email', 'is', null);

      // Получаем последние уведомления
      const { data: recentNotifications } = await supabase
        .from('email_notifications_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setStats({
        total_sent: totalSent || 0,
        total_failed: totalFailed || 0,
        users_with_notifications: usersWithNotifications || 0,
        recent_notifications: recentNotifications || []
      });
    } catch (error) {
      console.error('Error fetching email stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    if (!testPokemonId.trim()) {
      setTestResult({ success: false, message: 'Please enter a Pokemon ID' });
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      // Вызываем функцию для отправки тестового уведомления
      const { error } = await supabase.rpc('send_test_notification', {
        pokemon_id: parseInt(testPokemonId)
      });

      if (error) {
        throw error;
      }

      setTestResult({ 
        success: true, 
        message: `Test notification sent for Pokemon ID ${testPokemonId}` 
      });
      setTestPokemonId('');
      
      // Обновляем статистику через несколько секунд
      setTimeout(fetchEmailStats, 3000);
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error.message || 'Failed to send test notification' 
      });
    } finally {
      setSendingTest(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'failed':
        return <XCircle className="text-red-500" size={16} />;
      default:
        return <Clock className="text-yellow-500" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading email statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center">
          <Mail className="mr-3" size={32} />
          Email Notifications Manager
        </h2>
        <p className="text-gray-600">Manage and monitor email notifications for new Pokemon</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Emails Sent</p>
              <p className="text-3xl font-bold">{stats.total_sent}</p>
            </div>
            <CheckCircle size={32} className="text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Failed Emails</p>
              <p className="text-3xl font-bold">{stats.total_failed}</p>
            </div>
            <XCircle size={32} className="text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Subscribed Users</p>
              <p className="text-3xl font-bold">{stats.users_with_notifications}</p>
            </div>
            <Users size={32} className="text-blue-200" />
          </div>
        </div>
      </div>

      {/* Test Notification Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <Send className="mr-2" size={20} />
          Send Test Notification
        </h3>
        
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pokemon ID
            </label>
            <input
              type="number"
              value={testPokemonId}
              onChange={(e) => setTestPokemonId(e.target.value)}
              placeholder="Enter Pokemon ID (e.g., 25 for Pikachu)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={sendTestNotification}
            disabled={sendingTest || !testPokemonId.trim()}
            className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingTest ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending...
              </>
            ) : (
              <>
                <Send size={16} className="mr-2" />
                Send Test
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-4 rounded-lg flex items-start ${
            testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {testResult.success ? (
              <CheckCircle className="text-green-500 mr-2 mt-0.5" size={20} />
            ) : (
              <AlertCircle className="text-red-500 mr-2 mt-0.5" size={20} />
            )}
            <div>
              <h4 className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {testResult.success ? 'Success!' : 'Error'}
              </h4>
              <p className={`text-sm mt-1 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {testResult.message}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Notifications</h3>
        
        {stats.recent_notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Mail size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No email notifications sent yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pokemon
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recent_notifications.map((notification) => (
                  <tr key={notification.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 capitalize">
                            {notification.pokemon_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {notification.pokemon_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(notification.email_status)}`}>
                        {getStatusIcon(notification.email_status)}
                        <span className="ml-1 capitalize">{notification.email_status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(notification.email_sent_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {notification.user_id.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailNotificationsManager;