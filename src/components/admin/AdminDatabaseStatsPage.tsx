import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Database, Heart, Star, Eye, EyeOff, TrendingUp, Calendar, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AdminDatabaseStatsPageProps {
  onBack: () => void;
}

interface UserStats {
  user_id: string;
  user_email: string;
  user_name: string;
  total_pokemon: number;
  favorites_count: number;
  hidden_pokemon: number;
  new_pokemon: number;
  last_activity: string;
}

interface GlobalStats {
  total_users: number;
  total_pokemon_in_db: number;
  total_user_pokemon: number;
  total_favorites: number;
  hidden_pokemon_count: number;
  new_pokemon_count: number;
}

const AdminDatabaseStatsPage: React.FC<AdminDatabaseStatsPageProps> = ({ onBack }) => {
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    total_users: 0,
    total_pokemon_in_db: 0,
    total_user_pokemon: 0,
    total_favorites: 0,
    hidden_pokemon_count: 0,
    new_pokemon_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Глобальная статистика
      const [
        { count: totalUsers },
        { count: totalPokemonInDb },
        { count: totalUserPokemon },
        { count: totalFavorites },
        { count: hiddenPokemonCount },
        { count: newPokemonCount }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('external_pokemon').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('user_pokemon').select('*', { count: 'exact', head: true }),
        supabase.from('user_pokemon').select('*', { count: 'exact', head: true }).eq('is_favorite', true),
        supabase.from('external_pokemon').select('*', { count: 'exact', head: true }).eq('is_hidden', true),
        supabase.from('external_pokemon').select('*', { count: 'exact', head: true }).gt('new_until', 'now()')
      ]);

      setGlobalStats({
        total_users: totalUsers || 0,
        total_pokemon_in_db: totalPokemonInDb || 0,
        total_user_pokemon: totalUserPokemon || 0,
        total_favorites: totalFavorites || 0,
        hidden_pokemon_count: hiddenPokemonCount || 0,
        new_pokemon_count: newPokemonCount || 0
      });

      // Статистика по пользователям
      const { data: userStatsData, error } = await supabase.rpc('get_user_pokemon_stats');
      
      if (error) {
        console.error('Error fetching user stats:', error);
        // Fallback: получаем базовую статистику
        await fetchBasicUserStats();
      } else {
        setUserStats(userStatsData || []);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      await fetchBasicUserStats();
    } finally {
      setLoading(false);
    }
  };

  const fetchBasicUserStats = async () => {
    try {
      // Получаем всех пользователей
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at');

      if (usersError) throw usersError;

      const userStatsPromises = users?.map(async (user) => {
        const [
          { count: totalPokemon },
          { count: favoritesCount },
          { data: lastActivity }
        ] = await Promise.all([
          supabase.from('user_pokemon').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('user_pokemon').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_favorite', true),
          supabase.from('user_pokemon').select('created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
        ]);

        return {
          user_id: user.id,
          user_email: user.email || '',
          user_name: user.full_name || 'Без имени',
          total_pokemon: totalPokemon || 0,
          favorites_count: favoritesCount || 0,
          hidden_pokemon: 0, // Пока не реализовано для пользователей
          new_pokemon: 0, // Пока не реализовано для пользователей
          last_activity: lastActivity?.[0]?.created_at || user.created_at
        };
      }) || [];

      const resolvedStats = await Promise.all(userStatsPromises);
      setUserStats(resolvedStats);
    } catch (error) {
      console.error('Error fetching basic user stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center mb-6">
          <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mr-4">
            <ArrowLeft size={20} className="mr-2" />
            Back to Dashboard
          </button>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mr-4">
            <ArrowLeft size={20} className="mr-2" />
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Database Statistics</h2>
        </div>
      </div>

      {/* Глобальная статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Users</p>
              <p className="text-3xl font-bold">{globalStats.total_users}</p>
            </div>
            <Users size={32} className="text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Pokémon in Database</p>
              <p className="text-3xl font-bold">{globalStats.total_pokemon_in_db}</p>
            </div>
            <Database size={32} className="text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">User Collections</p>
              <p className="text-3xl font-bold">{globalStats.total_user_pokemon}</p>
            </div>
            <Activity size={32} className="text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Favorites</p>
              <p className="text-3xl font-bold">{globalStats.total_favorites}</p>
            </div>
            <Heart size={32} className="text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-100 text-sm">Hidden Pokémon</p>
              <p className="text-3xl font-bold">{globalStats.hidden_pokemon_count}</p>
            </div>
            <EyeOff size={32} className="text-gray-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">New Pokémon</p>
              <p className="text-3xl font-bold">{globalStats.new_pokemon_count}</p>
            </div>
            <Star size={32} className="text-yellow-200" />
          </div>
        </div>
      </div>

      {/* Статистика пользователей */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Список пользователей */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">User Statistics</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {userStats.map((user) => (
              <div
                key={user.user_id}
                onClick={() => setSelectedUser(user)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedUser?.user_id === user.user_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-800">{user.user_name}</h4>
                    <p className="text-sm text-gray-500">{user.user_email}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center text-blue-600">
                        <Database size={14} className="mr-1" />
                        {user.total_pokemon}
                      </span>
                      <span className="flex items-center text-red-600">
                        <Heart size={14} className="mr-1" />
                        {user.favorites_count}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Детали выбранного пользователя */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">User Details</h3>
          {selectedUser ? (
            <div className="space-y-6">
              <div className="text-center pb-4 border-b border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800">{selectedUser.user_name}</h4>
                <p className="text-gray-500">{selectedUser.user_email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <Database className="mx-auto mb-2 text-blue-600" size={24} />
                  <p className="text-2xl font-bold text-blue-600">{selectedUser.total_pokemon}</p>
                  <p className="text-sm text-gray-600">Total Pokémon</p>
                </div>

                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <Heart className="mx-auto mb-2 text-red-600" size={24} />
                  <p className="text-2xl font-bold text-red-600">{selectedUser.favorites_count}</p>
                  <p className="text-sm text-gray-600">Favorites</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <EyeOff className="mx-auto mb-2 text-gray-600" size={24} />
                  <p className="text-2xl font-bold text-gray-600">{selectedUser.hidden_pokemon}</p>
                  <p className="text-sm text-gray-600">Hidden</p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <Star className="mx-auto mb-2 text-yellow-600" size={24} />
                  <p className="text-2xl font-bold text-yellow-600">{selectedUser.new_pokemon}</p>
                  <p className="text-sm text-gray-600">New</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar size={16} className="mr-2" />
                  Last activity: {new Date(selectedUser.last_activity).toLocaleDateString()}
                </div>
              </div>

              {/* Прогресс-бары */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Collection Progress</span>
                    <span>{Math.round((selectedUser.total_pokemon / globalStats.total_pokemon_in_db) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((selectedUser.total_pokemon / globalStats.total_pokemon_in_db) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Favorite Rate</span>
                    <span>
                      {selectedUser.total_pokemon > 0
                        ? Math.round((selectedUser.favorites_count / selectedUser.total_pokemon) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${selectedUser.total_pokemon > 0
                          ? Math.min((selectedUser.favorites_count / selectedUser.total_pokemon) * 100, 100)
                          : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Select a user to view detailed statistics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDatabaseStatsPage;