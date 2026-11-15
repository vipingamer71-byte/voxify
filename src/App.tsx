import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BookA,
  Bot,
  Code2,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Mic,
  Plug,
  Settings as SettingsIcon,
  Sliders,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { PlanModal } from './components/PlanModal';
import { VoxifyLogo } from './components/VoxifyLogo';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  DEFAULT_SETTINGS,
  DEFAULT_WHISPER_CONFIG,
  PREDEFINED_MODES,
} from './data/defaults';
import { formatFirebaseError } from './services/firebase';
import {
  clearUserConversations,
  clearUserHistory,
  createActivityEventDoc,
  createHistoryEntry,
  createVocabularyDoc,
  deleteConversationDoc,
  deleteCustomModeDoc,
  deleteHistoryEntryDoc,
  deleteVocabularyDoc,
  ensureUserProfile,
  resetUserWorkspace,
  saveConversationDoc,
  saveCustomModeDoc,
  saveUserSettings,
  saveUserWhisperConfig,
  subscribeActivity,
  subscribeConversations,
  subscribeHistory,
  subscribeModes,
  subscribeUserProfile,
  subscribeVocabulary,
  updateHistoryEntryDoc,
  updateVocabularyDoc,
} from './services/firestoreSync';
import type {
  ActivityEvent,
  ChatConversation,
  CustomMode,
  NavSection,
  VocabularyItem,
  VoiceHistoryEntry,
  VoxifySettings,
  WhisperConfig,
} from './types/voxify';

// Lazy-load all workspace views for fast initial startup and code-splitting
const OverviewView = lazy(() =>
  import('./views/OverviewView').then((m) => ({ default: m.OverviewView }))
);
const LiveDictationView = lazy(() =>
  import('./views/LiveDictationView').then((m) => ({ default: m.LiveDictationView }))
);
const AiAssistantView = lazy(() =>
  import('./views/AiAssistantView').then((m) => ({ default: m.AiAssistantView }))
);
const AiRewriteView = lazy(() =>
  import('./views/AiRewriteView').then((m) => ({ default: m.AiRewriteView }))
);
const VoiceHistoryView = lazy(() =>
  import('./views/VoiceHistoryView').then((m) => ({ default: m.VoiceHistoryView }))
);
const CustomModesView = lazy(() =>
  import('./views/CustomModesView').then((m) => ({ default: m.CustomModesView }))
);
const DeveloperModeView = lazy(() =>
  import('./views/DeveloperModeView').then((m) => ({ default: m.DeveloperModeView }))
);
const VocabularyView = lazy(() =>
  import('./views/VocabularyView').then((m) => ({ default: m.VocabularyView }))
);
const IntegrationsView = lazy(() =>
  import('./views/IntegrationsView').then((m) => ({ default: m.IntegrationsView }))
);
const AnalyticsView = lazy(() =>
  import('./views/AnalyticsView').then((m) => ({ default: m.AnalyticsView }))
);
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'dictation', label: 'Live Dictation', icon: Mic },
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
  { id: 'rewrite', label: 'AI Rewrite', icon: Wand2 },
  { id: 'history', label: 'Voice History', icon: History },
  { id: 'modes', label: 'Custom Modes', icon: Sliders },
  { id: 'developer', label: 'Developer Mode', icon: Code2 },
  { id: 'vocabulary', label: 'Vocabulary', icon: BookA },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const ViewFallback: React.FC = () => (
  <div className="flex items-center justify-center py-24 text-xs text-slate-400 gap-2">
    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
    <span>Loading workspace module...</span>
  </div>
);

const VoxifyWorkspace: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();

  const [settings, setSettings] = useState<VoxifySettings>(DEFAULT_SETTINGS);
  const [whisperConfig, setWhisperConfig] = useState<WhisperConfig>(DEFAULT_WHISPER_CONFIG);
  const [plan, setPlan] = useState<'Free' | 'Pro' | 'Team'>('Free');
  const [activeSection, setActiveSection] = useState<NavSection>('overview');

  const [history, setHistory] = useState<VoiceHistoryEntry[]>([]);
  const [historyLimit, setHistoryLimit] = useState(30);
  const [userModes, setUserModes] = useState<CustomMode[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [chatLimit, setChatLimit] = useState(20);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const [syncReady, setSyncReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [rewritePrefill, setRewritePrefill] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const reportError = useCallback((err: unknown) => {
    setSyncError(formatFirebaseError(err));
  }, []);

  // Boot Firestore listeners strictly when user is authenticated AND email verified
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setSyncReady(false);
      setHistory([]);
      setUserModes([]);
      setVocabulary([]);
      setChats([]);
      setActivity([]);
      return;
    }

    let active = true;
    const unsubs: Array<() => void> = [];

    ensureUserProfile(user)
      .then((profile) => {
        if (!active) return;
        setSettings(profile.settings);
        if (profile.whisperConfig) setWhisperConfig(profile.whisperConfig);
        setPlan(profile.plan || 'Free');
        if (profile.settings?.general?.startupView) {
          setActiveSection(profile.settings.general.startupView);
        }
        setSyncReady(true);

        unsubs.push(
          subscribeUserProfile(
            user.uid,
            (updatedProfile) => {
              if (updatedProfile.settings) setSettings(updatedProfile.settings);
              if (updatedProfile.whisperConfig) setWhisperConfig(updatedProfile.whisperConfig);
              if (updatedProfile.plan) setPlan(updatedProfile.plan);
            },
            reportError
          ),
          subscribeModes(user.uid, setUserModes, reportError),
          subscribeVocabulary(user.uid, setVocabulary, reportError),
          subscribeActivity(user.uid, setActivity, reportError)
        );
      })
      .catch((err) => {
        if (active) {
          reportError(err);
          setSyncReady(true);
        }
      });

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [user, reportError]);

  // Progressive History Listener
  useEffect(() => {
    if (!user || !user.emailVerified || !syncReady) return;
    return subscribeHistory(user.uid, historyLimit, setHistory, reportError);
  }, [user, syncReady, historyLimit, reportError]);

  // Progressive Conversations Listener
  useEffect(() => {
    if (!user || !user.emailVerified || !syncReady) return;
    return subscribeConversations(user.uid, chatLimit, setChats, reportError);
  }, [user, syncReady, chatLimit, reportError]);

  // Merge user-saved custom modes with built-in writing templates
  const modes = useMemo(() => {
    const savedMap = new Map(userModes.map((m) => [m.id, m]));
    const mergedBuiltIns = PREDEFINED_MODES.map((preset) => savedMap.get(preset.id) || preset);
    const customCreated = userModes.filter(
      (m) => !PREDEFINED_MODES.some((p) => p.id === m.id)
    );
    return [...customCreated, ...mergedBuiltIns];
  }, [userModes]);

  const activeNav = useMemo(
    () => NAV_ITEMS.find((item) => item.id === activeSection) || NAV_ITEMS[0],
    [activeSection]
  );

  const displayName =
    settings.general.userName || user?.displayName || user?.email?.split('@')[0] || 'VOXIFY User';

  const userInitials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    return (
      parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('') || 'V'
    );
  }, [displayName]);

  const handleLogActivity = useCallback(
    async (event: Omit<ActivityEvent, 'id' | 'date'>) => {
      if (!user || !settings.privacy.analyticsTracking) return;
      try {
        await createActivityEventDoc(user.uid, event);
      } catch (err) {
        reportError(err);
      }
    },
    [user, settings.privacy.analyticsTracking, reportError]
  );

  const handleSaveTranscript = useCallback(
    async (entry: Omit<VoiceHistoryEntry, 'id' | 'createdAt'>) => {
      if (!user) return;
      try {
        await createHistoryEntry(user.uid, entry);
        if (settings.privacy.analyticsTracking) {
          await createActivityEventDoc(user.uid, {
            type: 'dictation',
            words: entry.wordCount,
            durationSec: entry.durationSec,
            languageName: entry.languageName,
          });
        }
      } catch (err) {
        reportError(err);
      }
    },
    [user, settings.privacy.analyticsTracking, reportError]
  );

  const handleUpdateHistoryEntry = useCallback(
    async (updated: VoiceHistoryEntry) => {
      if (!user) return;
      try {
        await updateHistoryEntryDoc(user.uid, updated);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleDeleteHistoryEntry = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteHistoryEntryDoc(user.uid, id);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleSaveMode = useCallback(
    async (mode: CustomMode, isNew: boolean) => {
      if (!user) return;
      try {
        await saveCustomModeDoc(user.uid, mode, isNew);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleDeleteMode = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteCustomModeDoc(user.uid, id);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleAddVocab = useCallback(
    async (item: Omit<VocabularyItem, 'id' | 'createdAt'>) => {
      if (!user) return;
      try {
        await createVocabularyDoc(user.uid, item);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleUpdateVocab = useCallback(
    async (updated: VocabularyItem) => {
      if (!user) return;
      try {
        await updateVocabularyDoc(user.uid, updated);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleDeleteVocab = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteVocabularyDoc(user.uid, id);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleSaveChat = useCallback(
    async (conv: ChatConversation, isNew: boolean) => {
      if (!user) return;
      try {
        await saveConversationDoc(user.uid, conv, isNew);
      } catch (err) {
        reportError(err);
        throw err;
      }
    },
    [user, reportError]
  );

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      if (!user) return;
      try {
        await deleteConversationDoc(user.uid, chatId);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleUpdateSettings = useCallback(
    async (next: VoxifySettings) => {
      if (!user) return;
      setSettings(next);
      try {
        await saveUserSettings(user.uid, next);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleSaveWhisperConfig = useCallback(
    async (next: WhisperConfig) => {
      if (!user) return;
      setWhisperConfig(next);
      try {
        await saveUserWhisperConfig(user.uid, next);
      } catch (err) {
        reportError(err);
      }
    },
    [user, reportError]
  );

  const handleExportAll = useCallback(() => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        product: 'VOXIFY',
        uid: user?.uid,
        email: user?.email,
        settings,
        whisperConfig,
        history,
        customModes: userModes,
        vocabulary,
        conversations: chats,
        activity,
      },
      null,
      2
    );
  }, [user, settings, whisperConfig, history, userModes, vocabulary, chats, activity]);

  const handleOpenRewriteWithText = useCallback((text: string) => {
    setRewritePrefill(text);
    setActiveSection('rewrite');
  }, []);

  const handleSelectNav = useCallback((section: NavSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#07070B] flex flex-col items-center justify-center gap-3 text-slate-300">
        <VoxifyLogo />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          <span>Restoring secure session...</span>
        </div>
      </div>
    );
  }

  if (!user || !user.emailVerified) {
    return <AuthGate />;
  }

  const ambientBackdrop =
    settings.general.appearance === 'midnight-cyan'
      ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(79,70,229,0.10),transparent_50%)]'
      : settings.general.appearance === 'carbon-minimal'
        ? 'bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_55%)]'
        : 'bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.15),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.08),transparent_45%)]';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#090A10]/95 backdrop-blur-xl border-r border-white/[0.07]">
      <div className="p-4 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between px-1.5">
          <VoxifyLogo />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-violet-600/25 to-indigo-600/10 text-white border border-violet-400/30 shadow-[0_0_20px_rgba(124,58,237,0.15)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile, Logout & Upgrade Section */}
      <div className="p-4 border-t border-white/[0.07] space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/40 to-cyan-500/25 border border-violet-400/30 text-xs font-semibold text-white shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400 truncate">{plan} Plan</p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setUpgradeModalOpen(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/35 bg-gradient-to-r from-violet-600/25 to-cyan-500/15 px-3 py-2 text-xs font-medium text-white hover:from-violet-600/40 hover:to-cyan-500/25 transition-colors whitespace-nowrap"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          Upgrade Plan
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-[#07070B] text-slate-100 flex ${ambientBackdrop}`}>
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 h-full">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/[0.07] bg-[#07070B]/85 backdrop-blur-xl px-4 sm:px-8 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-slate-300 hover:text-white"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap shrink-0">
              <span className="font-display font-semibold text-slate-400">VOXIFY</span>
              <span aria-hidden="true" className="text-slate-600">/</span>
              <span className="font-medium text-white">{activeNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('dictation')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap shrink-0"
            >
              <Activity className="h-3.5 w-3.5" />
              Live Studio
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1280px] w-full mx-auto space-y-4">
          {syncError && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-xs text-rose-100">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{syncError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncError(null)}
                className="text-rose-300 hover:text-white shrink-0"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!syncReady ? (
            <ViewFallback />
          ) : (
            <Suspense fallback={<ViewFallback />}>
              {activeSection === 'overview' && (
                <OverviewView
                  settings={settings}
                  vocabulary={vocabulary}
                  history={history}
                  activity={activity}
                  onSaveTranscript={handleSaveTranscript}
                  onLogActivity={handleLogActivity}
                  onOpenRewriteWithText={handleOpenRewriteWithText}
                />
              )}

              {activeSection === 'dictation' && (
                <LiveDictationView
                  settings={settings}
                  vocabulary={vocabulary}
                  history={history}
                  onSaveTranscript={handleSaveTranscript}
                  onLogActivity={handleLogActivity}
                  onOpenRewriteWithText={handleOpenRewriteWithText}
                />
              )}

              {activeSection === 'assistant' && (
                <AiAssistantView
                  settings={settings}
                  vocabulary={vocabulary}
                  customModes={modes}
                  chats={chats}
                  hasMoreChats={chats.length >= chatLimit}
                  onLoadMoreChats={() => setChatLimit((l) => l + 20)}
                  onSaveChat={handleSaveChat}
                  onDeleteChat={handleDeleteChat}
                  onLogActivity={handleLogActivity}
                />
              )}

              {activeSection === 'rewrite' && (
                <AiRewriteView
                  initialText={rewritePrefill}
                  settings={settings}
                  customModes={modes}
                  vocabulary={vocabulary}
                  onLogActivity={handleLogActivity}
                />
              )}

              {activeSection === 'history' && (
                <VoiceHistoryView
                  history={history}
                  hasMoreHistory={history.length >= historyLimit}
                  onLoadMoreHistory={() => setHistoryLimit((l) => l + 30)}
                  onUpdateEntry={handleUpdateHistoryEntry}
                  onDeleteEntry={handleDeleteHistoryEntry}
                  onSendToRewrite={handleOpenRewriteWithText}
                />
              )}

              {activeSection === 'modes' && (
                <CustomModesView
                  modes={modes}
                  settings={settings}
                  vocabulary={vocabulary}
                  onSaveMode={handleSaveMode}
                  onDeleteMode={handleDeleteMode}
                  onLogActivity={handleLogActivity}
                />
              )}

              {activeSection === 'developer' && (
                <DeveloperModeView
                  settings={settings}
                  vocabulary={vocabulary}
                  onLogActivity={handleLogActivity}
                />
              )}

              {activeSection === 'vocabulary' && (
                <VocabularyView
                  vocabulary={vocabulary}
                  onAddItem={handleAddVocab}
                  onUpdateItem={handleUpdateVocab}
                  onDeleteItem={handleDeleteVocab}
                />
              )}

              {activeSection === 'integrations' && (
                <IntegrationsView
                  whisperConfig={whisperConfig}
                  onSaveWhisperConfig={handleSaveWhisperConfig}
                />
              )}

              {activeSection === 'analytics' && (
                <AnalyticsView activity={activity} history={history} />
              )}

              {activeSection === 'settings' && (
                <SettingsView
                  userEmail={user.email || ''}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onExportAll={handleExportAll}
                  onClearHistory={async () => {
                    await clearUserHistory(user.uid);
                  }}
                  onClearChats={async () => {
                    await clearUserConversations(user.uid);
                  }}
                  onResetAll={async () => {
                    await resetUserWorkspace(user.uid, user);
                  }}
                  onLogout={logout}
                />
              )}
            </Suspense>
          )}
        </main>
      </div>

      <PlanModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <VoxifyWorkspace />
    </AuthProvider>
  );
}
