import React, { useState, useEffect } from 'react';
import { supabase, apiCall, isServerAvailable } from '/src/lib/supabase';
import { offlineManager } from '/src/lib/offline';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { Badge } from './components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from './components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ScrollArea } from './components/ui/scroll-area';
import { Separator } from './components/ui/separator';
import { Progress } from './components/ui/progress';
import { toast, Toaster } from 'sonner';
import { 
  Home, Users, Dog, MessageSquare, BarChart3, Settings, 
  UserPlus, Plus, WifiOff, Wifi, RefreshCw, LogOut, Menu,
  Syringe, Calendar, Bell, Phone, Mail, MapPin, Award,
  Search, Filter, Download, ChevronRight, AlertCircle, CheckCircle2,
  Clock, User, Building2, MoreVertical, Edit, Trash2
} from 'lucide-react';
import { 
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from './components/ui/select';

interface User {
  id: string;
  email: string;
  fullName: string;
  clinicId: string;
  role: 'admin' | 'staff';
}

interface Clinic {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    checkAuth();
    
    // Listen to offline status changes
    const unsubscribe = offlineManager.onStatusChange((status: boolean) => {
      setIsOnline(status);
      if (status) {
        syncOfflineChanges();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Update pending changes count
    setPendingChanges(offlineManager.getPendingCount());
  }, [currentView]);

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const serverOk = await isServerAvailable();
        if (serverOk) {
          const profile = await apiCall('/auth/me');
          setUser(profile.user);
          if (profile.user.clinicId) {
            const clinicData = await apiCall(`/clinics/${profile.user.clinicId}`);
            setClinic(clinicData.clinic);
          }
        } else {
          const meta: any = session.user.user_metadata || {};
          const fallbackUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: meta.full_name || session.user.email || 'User',
            clinicId: meta.clinic_id || '',
            role: meta.role === 'admin' ? 'admin' : 'staff',
          };
          setUser(fallbackUser);
          setClinic(null);
          toast.warning('Connected without server. Some features are limited.');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function syncOfflineChanges() {
    const pending = offlineManager.getPendingChanges();
    if (pending.length === 0) return;

    setSyncing(true);
    try {
      const result = await apiCall('/sync', {
        method: 'POST',
        body: JSON.stringify({ changes: pending }),
      });

      result.synced.forEach((item: any) => {
        offlineManager.markAsSynced(item.localId);
      });

      if (result.conflicts.length > 0) {
        toast.warning(`${result.conflicts.length} conflicts detected. Please review.`);
      }

      offlineManager.clearSynced();
      setPendingChanges(offlineManager.getPendingCount());
      setLastSyncTime(new Date());
      toast.success('Changes synced successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Sync failed. Will retry later.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setClinic(null);
    setCurrentView('dashboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading PetShield...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={checkAuth} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" richColors />
      
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Dog className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-gray-900">PetShield</h1>
                <p className="text-xs text-gray-500">{clinic?.name || 'Veterinary Clinic'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Offline/Online Status */}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-200">
                    <Wifi className="h-3 w-3" />
                    Online
                  </Badge>
                  {lastSyncTime && (
                    <span className="hidden sm:inline text-xs text-gray-500">
                      Synced {formatTimeAgo(lastSyncTime)}
                    </span>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="gap-1 text-orange-600 border-orange-200">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              )}
              
              {pendingChanges > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={syncOfflineChanges}
                  disabled={!isOnline || syncing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{pendingChanges} pending</span>
                </Button>
              )}
            </div>

            {/* Quick Add Button */}
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </Button>

            {/* User Menu */}
            <div className="flex items-center gap-2 pl-2 border-l">
              <div className="hidden sm:block text-right text-sm">
                <p className="font-medium text-gray-900">{user.fullName}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-orange-800">
              <WifiOff className="h-4 w-4" />
              <span>Offline mode: changes saved on this device.</span>
              {pendingChanges > 0 && (
                <span className="font-medium">{pendingChanges} changes pending sync.</span>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-1">
            <NavItem icon={Home} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
            <NavItem icon={Users} label="Owners" active={currentView === 'owners'} onClick={() => setCurrentView('owners')} />
            <NavItem icon={Dog} label="Animals" active={currentView === 'animals'} onClick={() => setCurrentView('animals')} />
            <NavItem icon={MessageSquare} label="Messages" active={currentView === 'messages'} onClick={() => setCurrentView('messages')} />
            <NavItem icon={BarChart3} label="Reports" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
            
            {user.role === 'admin' && (
              <>
                <Separator className="my-2" />
                <NavItem icon={Settings} label="Clinic Settings" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
                <NavItem icon={UserPlus} label="Staff Management" active={currentView === 'staff'} onClick={() => setCurrentView('staff')} />
              </>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          {currentView === 'dashboard' && <Dashboard user={user} clinic={clinic} onNavigate={setCurrentView} />}
          {currentView === 'owners' && <OwnersView user={user} />}
          {currentView === 'animals' && <AnimalsView user={user} />}
          {currentView === 'messages' && <MessagesView user={user} />}
          {currentView === 'reports' && <ReportsView user={user} />}
          {currentView === 'settings' && user.role === 'admin' && <SettingsView clinic={clinic} setClinic={setClinic} />}
          {currentView === 'staff' && user.role === 'admin' && <StaffView user={user} />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around px-2 py-2">
          <MobileNavItem icon={Home} label="Home" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <MobileNavItem icon={Users} label="Owners" active={currentView === 'owners'} onClick={() => setCurrentView('owners')} />
          <MobileNavItem icon={Dog} label="Animals" active={currentView === 'animals'} onClick={() => setCurrentView('animals')} />
          <MobileNavItem icon={MessageSquare} label="Messages" active={currentView === 'messages'} onClick={() => setCurrentView('messages')} />
          <MobileNavItem icon={BarChart3} label="Reports" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function MobileNavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        active ? 'text-blue-700' : 'text-gray-600'
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      toast.success('Welcome to PetShield!');
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Login failed');
      toast.error('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, clinic_id: clinicId, role },
        },
      });
      if (signUpError) throw signUpError;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      toast.success('Account created');
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      toast.error('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
            <Dog className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">PetShield</CardTitle>
          <CardDescription>Veterinary Clinic Management System</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="staff@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Alex Vet"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="staff@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicId">Clinic ID</Label>
                  <Input
                    id="clinicId"
                    type="text"
                    placeholder="clinic-123"
                    value={clinicId}
                    onChange={(e) => setClinicId(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    disabled={loading}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-600">
            <p className="font-medium mb-2">Demo Note:</p>
            <p>This is a prototype for demonstration purposes.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard({ user, clinic, onNavigate }: { user: User; clinic: Clinic | null; onNavigate: (view: string) => void }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showAddAnimal, setShowAddAnimal] = useState(false);
  const [owners, setOwners] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadOwners();
  }, []);

  async function loadStats() {
    try {
      const data = await apiCall('/dashboard/stats');
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function loadOwners() {
    try {
      const data = await apiCall('/owners');
      setOwners(data.users || []);
    } catch (error) {
      console.error('Failed to load owners:', error);
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500">Welcome back, {user.fullName}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Dog}
          label="Total Animals"
          value={stats?.totalAnimals || 0}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Total Owners"
          value={stats?.totalOwners || 0}
          color="green"
        />
        <StatCard
          icon={Syringe}
          label="This Month"
          value={stats?.thisMonthVaccinations || 0}
          color="purple"
        />
        <StatCard
          icon={Calendar}
          label="Upcoming (7 days)"
          value={stats?.upcomingVaccinations || 0}
          color="orange"
        />
      </div>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Upcoming Tasks
          </CardTitle>
          <CardDescription>Vaccinations due in the next 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <EmptyState
              icon={CheckCircle2}
              title="All caught up!"
              description="No upcoming vaccinations in the next 7 days."
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActionCard
          icon={Users}
          title="Add Owner"
          description="Register a new pet owner"
          onClick={() => setShowAddOwner(true)}
        />
        <ActionCard
          icon={Dog}
          title="Add Animal"
          description="Register a new animal"
          onClick={() => setShowAddAnimal(true)}
        />
        <ActionCard
          icon={Syringe}
          title="Log Vaccination"
          description="Record a vaccination"
          onClick={() => {
            onNavigate('animals');
            toast.info('Select an animal to log vaccination');
          }}
        />
      </div>

      <AddOwnerDialog 
        open={showAddOwner} 
        onOpenChange={setShowAddOwner} 
        onSuccess={() => {
          loadStats();
          loadOwners();
          setShowAddOwner(false);
        }} 
      />

      <AddAnimalDialog 
        open={showAddAnimal} 
        onOpenChange={setShowAddAnimal} 
        onSuccess={() => {
          loadStats();
          setShowAddAnimal(false);
        }} 
        owners={owners}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: 'blue' | 'green' | 'purple' | 'orange' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({ icon: Icon, title, description, onClick }: any) {
  return (
    <Card 
      className={`cursor-pointer hover:border-blue-300 transition-colors ${onClick ? 'active:bg-blue-50' : ''}`}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description }: any) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}

function OwnersView({ user }: { user: User }) {
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingOwner, setEditingOwner] = useState<any>(null);

  useEffect(() => {
    loadOwners();
  }, []);

  async function loadOwners() {
    try {
      const data = await apiCall('/owners');
      setOwners(data.users || []);
    } catch (error) {
      console.error('Failed to load owners:', error);
      toast.error('Failed to load owners');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Pet Owners</h2>
        <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Owner
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading owners...</div>
      ) : owners.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Users}
              title="No owners yet"
              description="Start by adding your first pet owner."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {owners.map((owner) => (
            <Card key={owner.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {owner.fullName.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{owner.fullName}</h3>
                      <p className="text-sm text-gray-500">{owner.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setEditingOwner(owner)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 text-sm text-gray-600 space-y-1">
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {owner.phone || 'No phone'}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {owner.address || 'No address'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddOwnerDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
        onSuccess={() => {
          loadOwners();
          setShowAddDialog(false);
        }} 
      />

      {editingOwner && (
        <EditOwnerDialog
          owner={editingOwner}
          open={!!editingOwner}
          onOpenChange={(open) => !open && setEditingOwner(null)}
          onSuccess={() => {
            loadOwners();
            setEditingOwner(null);
          }}
        />
      )}
    </div>
  );
}

function AddOwnerDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
    };

    try {
      await apiCall('/owners', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast.success('Owner added successfully');
      onSuccess();
    } catch (error) {
      console.error('Failed to add owner:', error);
      toast.error('Failed to add owner');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Owner</DialogTitle>
          <DialogDescription>
            Enter the details of the pet owner.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" required placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="john@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" name="phone" placeholder="+1 234 567 8900" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="123 Main St" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Owner'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditOwnerDialog({ owner, open, onOpenChange, onSuccess }: { owner: any; open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
    };

    try {
      await apiCall(`/owners/${owner.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      toast.success('Owner updated successfully');
      onSuccess();
    } catch (error) {
      console.error('Failed to update owner:', error);
      toast.error('Failed to update owner');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Owner</DialogTitle>
          <DialogDescription>
            Update the details of the pet owner.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" defaultValue={owner.fullName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={owner.email} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" name="phone" defaultValue={owner.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={owner.address} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getAvatarColor(name: string) {
  const colors = ['bg-red-100 text-red-600', 'bg-green-100 text-green-600', 'bg-blue-100 text-blue-600', 'bg-yellow-100 text-yellow-600', 'bg-purple-100 text-purple-600', 'bg-pink-100 text-pink-600'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function AnimalsView({ user }: { user: User }) {
  const [animals, setAnimals] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<any>(null);
  const [activeAnimal, setActiveAnimal] = useState<any | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);

  useEffect(() => {
    loadAnimals();
    loadOwners();
  }, []);

  async function loadAnimals() {
    try {
      const data = await apiCall('/animals');
      setAnimals(data.animals || []);
    } catch (error) {
      console.error('Failed to load animals:', error);
      toast.error('Failed to load animals');
    } finally {
      setLoading(false);
    }
  }

  async function loadOwners() {
    try {
      const data = await apiCall('/owners');
      setOwners(data.users || []);
    } catch (error) {
      console.error('Failed to load owners:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Animals</h2>
        <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Animal
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading animals...</div>
      ) : animals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Dog}
              title="No animals yet"
              description="Start by registering your first animal."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {animals.map((animal) => (
            <Card key={animal.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${getAvatarColor(animal.name)}`}>
                      <Dog className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{animal.name}</h3>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {animal.species}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{animal.breed}</p>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {animal.age || 'Age N/A'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          <User className="w-3 h-3 mr-1" />
                          {owners.find((o: any) => o.id === animal.ownerId)?.fullName || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Manage {animal.name}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setEditingAnimal(animal)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setActiveAnimal(animal); setShowPlanDialog(true); }}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Vaccination
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setActiveAnimal(animal); setShowLogDialog(true); }}>
                        <Syringe className="mr-2 h-4 w-4" />
                        Log Vaccination
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Animal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddAnimalDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
        onSuccess={() => {
          loadAnimals();
          setShowAddDialog(false);
        }} 
        owners={owners}
      />

      {editingAnimal && (
        <EditAnimalDialog
          animal={editingAnimal}
          open={!!editingAnimal}
          onOpenChange={(open) => !open && setEditingAnimal(null)}
          onSuccess={() => {
            loadAnimals();
            setEditingAnimal(null);
          }}
          owners={owners}
        />
      )}

      {activeAnimal && (
        <>
          <AddVaccinationPlanDialog
            open={showPlanDialog}
            onOpenChange={(v) => { setShowPlanDialog(v); if (!v) setActiveAnimal(null); }}
            animal={activeAnimal}
            onSuccess={() => {
              toast.success('Vaccination plan scheduled');
              setShowPlanDialog(false);
            }}
          />
          <LogVaccinationDialog
            open={showLogDialog}
            onOpenChange={(v) => { setShowLogDialog(v); if (!v) setActiveAnimal(null); }}
            animal={activeAnimal}
            onSuccess={() => {
              toast.success('Vaccination logged');
              setShowLogDialog(false);
            }}
          />
        </>
      )}
    </div>
  );
}

function AddAnimalDialog({ open, onOpenChange, onSuccess, owners }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void; owners: any[] }) {
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      species: formData.get('species'),
      breed: formData.get('breed'),
      age: formData.get('age'),
      ownerId: formData.get('ownerId'),
    };

    try {
      await apiCall('/animals', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast.success('Animal added successfully');
      onSuccess();
    } catch (error) {
      console.error('Failed to add animal:', error);
      toast.error('Failed to add animal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Animal</DialogTitle>
          <DialogDescription>
            Enter the details of the animal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Buddy" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="species">Species</Label>
              <Input id="species" name="species" required placeholder="Dog" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="breed">Breed</Label>
              <Input id="breed" name="breed" placeholder="Golden Retriever" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input id="age" name="age" placeholder="2 years" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerId">Owner</Label>
            <select id="ownerId" name="ownerId" className="w-full rounded-md border px-3 py-2">
              <option value="">Unassigned</option>
              {owners.map((o: any) => (
                <option key={o.id} value={o.id}>{o.fullName}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Animal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAnimalDialog({ animal, open, onOpenChange, onSuccess, owners }: { animal: any; open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void; owners: any[] }) {
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      species: formData.get('species'),
      breed: formData.get('breed'),
      age: formData.get('age'),
      ownerId: formData.get('ownerId'),
    };

    try {
      await apiCall(`/animals/${animal.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      toast.success('Animal updated successfully');
      onSuccess();
    } catch (error) {
      console.error('Failed to update animal:', error);
      toast.error('Failed to update animal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Animal</DialogTitle>
          <DialogDescription>
            Update the details of the animal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" name="name" defaultValue={animal.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-species">Species</Label>
              <Input id="edit-species" name="species" defaultValue={animal.species} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-breed">Breed</Label>
              <Input id="edit-breed" name="breed" defaultValue={animal.breed} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-age">Age</Label>
            <Input id="edit-age" name="age" defaultValue={animal.age} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-ownerId">Owner</Label>
            <select 
              id="edit-ownerId" 
              name="ownerId" 
              className="w-full rounded-md border px-3 py-2"
              defaultValue={animal.ownerId}
            >
              <option value="">Unassigned</option>
              {owners.map((o: any) => (
                <option key={o.id} value={o.id}>{o.fullName}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddVaccinationPlanDialog({ open, onOpenChange, animal, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; animal: any; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      animalId: animal.id,
      vaccineName: formData.get('vaccineName'),
      intervalDays: formData.get('intervalDays'),
      nextDate: formData.get('nextDate'),
      notes: formData.get('notes'),
    };
    try {
      await apiCall('/vaccination-plan', { method: 'POST', body: JSON.stringify(data) });
      onSuccess();
    } catch (error) {
      toast.error('Failed to schedule plan');
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Vaccination</DialogTitle>
          <DialogDescription>Schedule a vaccination plan for {animal?.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vaccineName">Vaccine Name</Label>
            <Input id="vaccineName" name="vaccineName" required placeholder="Rabies" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="intervalDays">Interval (days)</Label>
              <Input id="intervalDays" name="intervalDays" type="number" placeholder="365" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextDate">Next Date</Label>
              <Input id="nextDate" name="nextDate" type="date" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="Details" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Scheduling...' : 'Schedule'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LogVaccinationDialog({ open, onOpenChange, animal, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; animal: any; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      animalId: animal.id,
      vaccineName: formData.get('vaccineName'),
      date: formData.get('date'),
      notes: formData.get('notes'),
    };
    try {
      await apiCall('/vaccination-log', { method: 'POST', body: JSON.stringify(data) });
      onSuccess();
    } catch (error) {
      toast.error('Failed to log vaccination');
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Vaccination</DialogTitle>
          <DialogDescription>Record a vaccination for {animal?.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vaccineName">Vaccine Name</Label>
            <Input id="vaccineName" name="vaccineName" required placeholder="Rabies" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="Details" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Logging...' : 'Log'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MessagesView({ user }: { user: User }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Messages</h2>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={MessageSquare}
            title="No messages sent"
            description="Send reminders and updates to pet owners."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsView({ user }: { user: User }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Reports & Analytics</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Vaccination Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>This Month</span>
                <span className="font-medium">0%</span>
              </div>
              <Progress value={0} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2">
              <Download className="h-4 w-4" />
              Export to CSV
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Download className="h-4 w-4" />
              Export to PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingsView({ clinic, setClinic }: { clinic: Clinic | null; setClinic: (c: Clinic) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Clinic Settings</h2>
      <Card>
        <CardHeader>
          <CardTitle>Clinic Profile</CardTitle>
          <CardDescription>Manage your clinic information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinic-name">Clinic Name</Label>
            <Input id="clinic-name" defaultValue={clinic?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-address">Address</Label>
            <Input id="clinic-address" defaultValue={clinic?.address} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-phone">Phone</Label>
              <Input id="clinic-phone" defaultValue={clinic?.phone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-email">Email</Label>
              <Input id="clinic-email" type="email" defaultValue={clinic?.email} />
            </div>
          </div>
          <Button className="mt-4">Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StaffView({ user }: { user: User }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Staff Management</h2>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={UserPlus}
            title="No staff members"
            description="Add staff members to collaborate on clinic operations."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
