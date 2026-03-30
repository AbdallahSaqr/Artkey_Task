'use client';

import { useState, useEffect } from 'react';
import { 
  Database, 
  AlertTriangle, 
  RefreshCw, 
  User, 
  Palette, 
  Bell, 
  Settings2, 
  Shield, 
  Mail,
  Globe,
  Save,
  Monitor,
  Moon,
  Sun,
  Camera,
  Upload,
  Users,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { seedMockData } from '@/lib/seed';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from '@/lib/supabase/client';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; role: string; email?: string; avatar_url?: string | null } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; full_name: string | null; email: string | null; role: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('full_name, role, avatar_url')
          .eq('id', user.id)
          .single();
        
        if (pData) {
          const profileData = { ...pData, email: user.email };
          setProfile(profileData);
          setFullName(pData.full_name || '');
        }

        const { data: wData } = await supabase
          .from('webhooks')
          .select('target_url')
          .maybeSingle();
        if (wData) setWebhookUrl(wData.target_url);

        if (pData?.role === 'Admin') {
          fetchAllUsers();
        }
      }
    }
    loadData();
  }, [supabase]);

  async function fetchAllUsers() {
    setLoadingUsers(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name', { ascending: true });

      if (error) throw error;

      // Get emails from auth — we'll use the current user's email for display
      // For other users, we show their profile name
      const users = (data || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: null,
        role: p.role || 'Member',
      }));

      setAllUsers(users);
    } catch (err: any) {
      toast.error('Failed to load users: ' + err.message);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

      // If the admin changed their own role, update local profile state
      const { data: { user } } = await supabase.auth.getUser();
      if (user && userId === user.id) {
        setProfile(prev => prev ? { ...prev, role: newRole } : null);
      }

      toast.success('Role updated successfully.');
    } catch (err: any) {
      toast.error('Failed to update role: ' + err.message);
    } finally {
      setUpdatingUserId(null);
    }
  }
 
  async function handleUploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
 
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
 
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;
 
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
 
      if (uploadError) throw uploadError;
 
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
 
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
 
      if (updateError) throw updateError;
 
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast.success('Identity visual updated.');
    } catch (error: any) {
      toast.error('Upload failure: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUpdateProfile() {
    setIsUpdatingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);
      
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, full_name: fullName } : null);
      toast.success('Profile updated.');
    } catch (error: any) {
      toast.error('Profile update failed: ' + error.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  async function handleSaveWebhook() {
    setIsSavingWebhook(true);
    try {
      const { data: existing } = await supabase.from('webhooks').select('id').maybeSingle();
      
      if (existing) {
        const { error } = await supabase.from('webhooks').update({ target_url: webhookUrl }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('webhooks').insert({ target_url: webhookUrl });
        if (error) throw error;
      }
      
      toast.success('Webhook saved.');
    } catch (error: any) {
      toast.error('Failed to save webhook: ' + error.message);
    } finally {
      setIsSavingWebhook(false);
    }
  }

  async function handleSeed() {
    setIsSeeding(true);
    try {
      await seedMockData();
      toast.success('Platform seeded with mock data.');
    } catch (error: any) {
      toast.error('Seeding failed: ' + error.message);
    } finally {
       setIsSeeding(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto w-full min-h-full pb-10">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Configuration Hub</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1 tracking-tight">
          Manage your administrative preferences and project triggers.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        {/* ── Tab Bar ─────────────────────────────────────────────────────
            h-auto + py-1.5 lets each trigger set its own height naturally,
            preventing the strip from being too short to contain its content. */}
        <TabsList className="flex w-full mb-4 bg-muted/20 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl h-auto gap-1">
          <TabsTrigger value="profile" className="flex-1 rounded-xl py-3 gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all font-bold tracking-tight text-xs justify-center">
            <User size={18} className="md:size-[15px]" /> <span className="hidden md:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex-1 rounded-xl py-3 gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all font-bold tracking-tight text-xs justify-center">
            <Palette size={18} className="md:size-[15px]" /> <span className="hidden md:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 rounded-xl py-3 gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all font-bold tracking-tight text-xs justify-center">
            <Bell size={18} className="md:size-[15px]" /> <span className="hidden md:inline">Webhooks</span>
          </TabsTrigger>
          {profile?.role === 'Admin' && (
            <TabsTrigger value="advanced" className="flex-1 rounded-xl py-3 gap-2 data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-500 transition-all font-bold tracking-tight text-xs justify-center">
              <Shield size={18} className="md:size-[15px]" /> <span className="hidden md:inline">Advanced</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Tab: Profile ────────────────────────────────────────────────── */}
        <TabsContent value="profile" className="outline-none mt-0">
          <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl overflow-hidden shadow-xl ring-1 ring-white/5">
            <CardHeader className="p-5 pb-3 border-b border-white/5 bg-white/5">
              <CardTitle className="text-lg font-bold tracking-tight">Identity Architecture</CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground/60">Configure how you are recognized in the orchestrator.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
                <div className="relative group/avatar cursor-pointer overflow-hidden">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary transition-all group-hover/avatar:scale-105 duration-500 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} />
                    )}
                  </div>
                  <label 
                    htmlFor="avatar-upload" 
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity cursor-pointer rounded-3xl"
                  >
                    {isUploading ? (
                      <RefreshCw className="animate-spin text-white" size={20} />
                    ) : (
                      <Camera className="text-white" size={20} />
                    )}
                  </label>
                  <input 
                    type="file" 
                    id="avatar-upload" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleUploadAvatar}
                    disabled={isUploading}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight text-foreground">{profile?.full_name || 'Artkey Architect'}</h3>
                    <Badge variant="outline" className={profile?.role === 'Admin' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}>
                      {profile?.role || 'Member'}
                    </Badge>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Mail size={12} className="opacity-50" /> {profile?.email || 'authenticated-user@artkey.dev'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="grid gap-2">
                  <Label htmlFor="full_name" className="text-xs font-bold tracking-tight text-muted-foreground ml-1">Distinguished Name</Label>
                  <Input 
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 bg-white/5 border-white/10 rounded-xl focus-visible:ring-primary/30"
                    placeholder="Enter your full name"
                  />
                </div>
                <Button 
                  onClick={handleUpdateProfile} 
                  disabled={isUpdatingProfile}
                  className="rounded-xl h-10 px-8 font-bold tracking-tight gap-2"
                >
                  {isUpdatingProfile ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Preferences ───────────────────────────────────────────── */}
        <TabsContent value="preferences" className="space-y-6 outline-none mt-0">
          <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl overflow-hidden shadow-xl ring-1 ring-white/5">
            <CardHeader className="p-5 pb-3 border-b border-white/5 bg-white/5">
              <CardTitle className="text-lg font-bold tracking-tight">Interface Aesthetic</CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground/60">Align the platform with your visual preference.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <RadioGroupItem value="light" id="light" className="peer sr-only" />
                  <Label
                    htmlFor="light"
                    className="flex flex-col items-center justify-between rounded-2xl border-2 border-white/5 bg-white/5 p-6 hover:bg-white/10 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer"
                  >
                    <Sun className="mb-3 h-6 w-6 text-amber-400" />
                    <span className="text-xs font-bold tracking-tight">Solarized</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                  <Label
                    htmlFor="dark"
                    className="flex flex-col items-center justify-between rounded-2xl border-2 border-white/5 bg-white/5 p-6 hover:bg-white/10 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer"
                  >
                    <Moon className="mb-3 h-6 w-6 text-violet-400" />
                    <span className="text-xs font-bold tracking-tight">Nocturnal</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="system" id="system" className="peer sr-only" />
                  <Label
                    htmlFor="system"
                    className="flex flex-col items-center justify-between rounded-2xl border-2 border-white/5 bg-white/5 p-6 hover:bg-white/10 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer"
                  >
                    <Monitor className="mb-3 h-6 w-6 text-blue-400" />
                    <span className="text-xs font-bold tracking-tight">Synchronised</span>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Webhooks ─────────────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-6 outline-none mt-0">
          <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl overflow-hidden shadow-xl ring-1 ring-white/5">
            <CardHeader className="p-5 pb-3 border-b border-white/5 bg-white/5">
              <CardTitle className="text-lg font-bold tracking-tight">Integration Triggers</CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground/60">Trigger webhooks for assignment life-cycle events.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Globe size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold tracking-tight">Slack & Discord Synchronization</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed tracking-tight">
                    Submit a target URL to broadcast events when assignments are created or reach delinquency.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="webhook_url" className="text-xs font-bold tracking-tight text-muted-foreground ml-1">Target End-Point URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="webhook_url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus-visible:ring-primary/30"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                    <Button 
                      onClick={handleSaveWebhook}
                      disabled={isSavingWebhook}
                      className="h-11 px-6 rounded-xl font-bold tracking-tight"
                    >
                      {isSavingWebhook ? <RefreshCw className="animate-spin" size={14} /> : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Advanced ─────────────────────────────────────────────── */}
        {profile?.role === 'Admin' && (
          <TabsContent value="advanced" className="space-y-6 outline-none mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl overflow-hidden shadow-xl ring-1 ring-white/5 border-rose-500/10">
                <CardHeader className="p-5 pb-3 border-b border-rose-500/5 bg-rose-500/5">
                  <CardTitle className="text-lg font-bold tracking-tight text-rose-500">Destructive Actions</CardTitle>
                  <CardDescription className="text-xs font-medium text-rose-500/50">Admin-only orchestration for testing and platform resetting.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                    <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-rose-400/80 leading-relaxed font-bold tracking-tight">
                      Warning: Seeding will insert duplicate entries. Use only in development environments to test the visual calendar and assignment tracking flows.
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger 
                      render={
                        <Button className="w-full h-12 rounded-xl bg-rose-500 text-white hover:bg-rose-600 font-bold tracking-tight gap-2 shadow-lg shadow-rose-500/20">
                          <Database size={16} />
                          Seed Platform Mock Data
                        </Button>
                      } 
                    />
                    <AlertDialogContent className="bg-card/95 backdrop-blur-3xl border-border/50 rounded-[32px] p-8 shadow-2xl">
                      <AlertDialogHeader className="space-y-3">
                        <AlertDialogTitle className="text-2xl font-black tracking-tighter text-rose-500 uppercase">Confirm Data Injection</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-muted-foreground/80 leading-relaxed">
                          This will populate the global assignments and schedule tables with mock data. This action is recorded in the administrative log.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-8 gap-3 sm:gap-0">
                        <AlertDialogCancel className="h-12 rounded-2xl border-white/10 bg-white/5 font-bold tracking-tight">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSeed} className="h-12 rounded-2xl bg-rose-500 text-white hover:bg-rose-600 font-bold tracking-tight">
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl overflow-hidden shadow-xl ring-1 ring-white/5 border-violet-500/10">
                <CardHeader className="p-5 pb-3 border-b border-violet-500/5 bg-violet-500/5">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Users size={18} className="text-violet-400" /> Role Management
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground/60">Assign Admin or Member roles to registered users.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-muted-foreground" size={20} />
                    </div>
                  ) : allUsers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No users found.</p>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {allUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary ring-1 ring-white/10 shrink-0">
                              {(u.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="text-sm font-medium tracking-tight text-foreground truncate">
                              {u.full_name || 'Unnamed User'}
                            </span>
                          </div>
                          <Select
                            value={u.role ?? ''}
                            onValueChange={(val) => { if (val !== null) handleRoleChange(u.id, val); }}
                            disabled={updatingUserId === u.id}
                          >
                            <SelectTrigger className="w-[120px] h-9 rounded-xl border-white/10 bg-white/5 text-xs font-bold tracking-tight shrink-0 cursor-pointer">
                              {updatingUserId === u.id ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-xl">
                              <SelectItem value="Admin" className="text-xs font-bold cursor-pointer">
                                <span className="flex items-center gap-2">
                                  <Shield size={12} className="text-violet-400" /> Admin
                                </span>
                              </SelectItem>
                              <SelectItem value="Member" className="text-xs font-bold cursor-pointer">
                                <span className="flex items-center gap-2">
                                  <User size={12} className="text-emerald-400" /> Member
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl overflow-hidden shadow-xl ring-1 ring-white/5">
                <CardHeader className="p-5 pb-3 border-b border-white/5 bg-white/5">
                  <CardTitle className="text-lg font-bold tracking-tight">Deployment Status</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3">
                      <Globe size={16} className="text-emerald-400" />
                      <span className="text-xs font-bold text-muted-foreground/80 tracking-tight">Supabase Cloud</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-black uppercase tracking-tighter">Active</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3">
                      <Settings2 size={16} className="text-emerald-400" />
                      <span className="text-xs font-bold text-muted-foreground/80 tracking-tight">Gemini AI Engine</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-black uppercase tracking-tighter">Operational</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}