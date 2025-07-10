import { 
  Users, 
  BarChart3, 
  Settings, 
  Plus, 
  FileText,
  ChevronRight,
  TrendingUp,
  Shield,
  Database,
  Download,
  PieChart,
  Mail
 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminDashboard from './admin/AdminDashboard';
import AdminUsersPage from './admin/AdminUsersPage';
import AdminPokemonPage from './admin/AdminPokemonPage';
import AdminStatsPage from './admin/AdminStatsPage';
import AdminManagementPage from './admin/AdminManagementPage';
import AdminAddPokemonPage from './admin/AdminAddPokemonPage';
import AdminEmptyPage from './admin/AdminEmptyPage';
import AdminAllPokemonPage from './admin/AdminAllPokemonPage';
import AdminDatabasePokemonPage from './admin/AdminDatabasePokemonPage';
import AdminDatabaseStatsPage from './admin/AdminDatabaseStatsPage';
import EmailNotificationsManager from './admin/EmailNotificationsManager';

type AdminView = 'dashboard' | 'users' | 'pokemon' | 'stats' | 'management' | 'add-pokemon' | 'empty' | 'all-pokemon' | 'database-pokemon' | 'database-stats' | 'email-notifications';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface Pokemon {
  id: string;
  name: string;
  type: string;
  rarity: string;
  image_url: string;
  created_at: string;
}

export default function AdminPanel() {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchPokemon();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchPokemon = async () => {
    try {
      const { data, error } = await supabase
        .from('pokemon')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPokemon(data || []);
    } catch (error) {
      console.error('Error fetching pokemon:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <AdminDashboard 
            users={users}
            pokemon={pokemon}
            onViewChange={setCurrentView}
          />
        );
      case 'users':
        return <AdminUsersPage users={users} onBack={() => setCurrentView('dashboard')} />;
      case 'pokemon':
        return <AdminPokemonPage pokemon={pokemon} onBack={() => setCurrentView('dashboard')} />;
      case 'stats':
        return <AdminStatsPage users={users} pokemon={pokemon} onBack={() => setCurrentView('dashboard')} />;
      case 'management':
        return <AdminManagementPage onBack={() => setCurrentView('dashboard')} />;
      case 'add-pokemon':
        return <AdminAddPokemonPage onBack={() => setCurrentView('dashboard')} onPokemonAdded={fetchPokemon} />;
      case 'all-pokemon':
        return <AdminAllPokemonPage onBack={() => setCurrentView('dashboard')} />;
      case 'database-pokemon':
        return <AdminDatabasePokemonPage onBack={() => setCurrentView('dashboard')} />;
      case 'database-stats':
        return <AdminDatabaseStatsPage onBack={() => setCurrentView('dashboard')} />;
      case 'email-notifications':
        return <EmailNotificationsManager />;
      case 'empty':
        return <AdminEmptyPage onBack={() => setCurrentView('dashboard')} />;
      default:
        return (
          <AdminDashboard 
            users={users}
            pokemon={pokemon}
            onViewChange={setCurrentView}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {renderCurrentView()}
    </div>
  );
}

// Quick actions for dashboard
export const quickActions = [
  {
    id: 'add-pokemon',
    title: 'Add Pokemon',
    description: 'Add new Pokemon to the collection',
    icon: Plus,
    color: 'from-green-500 to-green-600',
    stats: 'Quick add',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('add-pokemon')
  },
  {
    id: 'manage-users',
    title: 'Manage Users',
    description: 'View and manage user accounts',
    icon: Users,
    color: 'from-blue-500 to-blue-600',
    stats: 'User management',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('users')
  },
  {
    id: 'view-stats',
    title: 'View Statistics',
    description: 'Analyze platform performance',
    icon: BarChart3,
    color: 'from-purple-500 to-purple-600',
    stats: 'Analytics',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('stats')
  },
  {
    id: 'system-management',
    title: 'System Management',
    description: 'Configure system settings',
    icon: Settings,
    color: 'from-orange-500 to-orange-600',
    stats: 'Configuration',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('management')
  }
];

// Database management actions
export const databaseActions = [
  {
    id: 'all-pokemon',
    title: 'All Pokemon',
    description: 'View all Pokemon in the system',
    icon: FileText,
    color: 'from-indigo-500 to-indigo-600',
    stats: 'Complete list',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('all-pokemon')
  },
  {
    id: 'database-pokemon',
    title: 'Database Pokemon',
    description: 'Manage Pokemon database entries',
    icon: Database,
    color: 'from-teal-500 to-teal-600',
    stats: 'DB management',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('database-pokemon')
  },
  {
    id: 'database-stats',
    title: 'Database Statistics',
    description: 'View database performance metrics',
    icon: PieChart,
    color: 'from-cyan-500 to-cyan-600',
    stats: 'User insights',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('database-stats')
  },
  {
    id: 'email-notifications',
    title: 'Email Notifications',
    description: 'Manage email notifications for new Pokemon',
    icon: Mail,
    color: 'from-pink-500 to-pink-600',
    stats: 'Auto emails',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('email-notifications')
  },
  {
    id: 'stats',
    title: 'Advanced Stats',
    description: 'Detailed analytics and insights',
    icon: TrendingUp,
    color: 'from-emerald-500 to-emerald-600',
    stats: 'Deep insights',
    onClick: (setCurrentView: (view: AdminView) => void) => setCurrentView('stats')
  }
];