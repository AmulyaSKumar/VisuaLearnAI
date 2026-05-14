import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PersonaProvider, usePersona } from "./contexts/PersonaContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import WelcomeScreen from "./components/WelcomeScreen";
import PersonaSelectionModal from "./components/PersonaSelectionModal";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import NewChatPage from "./pages/NewChatPage";
import Dashboard from "./pages/Dashboard";
import LearningPage from "./pages/LearningPage";
import SettingsPage from "./pages/SettingsPage";
import HomePage from "./pages/HomePage";
import { useAuth } from "./contexts/AuthContext";
import {
  deleteConversation,
  getUserConversations,
  renameConversation,
} from "./lib/supabase";
import { sortConversations } from "./utils/conversationActions";

/**
 * AppContent: Main app routing logic
 * Separated from App to use useAuth() hook
 */
function AppContent() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { hasCompletedSetup, isLoading: personaLoading } = usePersona();
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    setLoadingConversations(true);

    try {
      const convs = await getUserConversations(user.id);
      // Filter out empty conversations (no messages)
      const nonEmptyConvs = (convs || []).filter(
        (conv) => conv.messageCount > 0 || conv.message_count > 0
      );
      setConversations(nonEmptyConvs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  }, [user]);

  // Load user's conversations when authenticated
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }
    loadConversations();
  }, [loadConversations, user]);

  const handleConversationCreated = useCallback((conversation) => {
    setConversations((currentConversations) => {
      const alreadyExists = currentConversations.some(
        (currentConversation) => currentConversation.id === conversation.id,
      );

      if (alreadyExists) {
        return currentConversations;
      }

      return sortConversations([
        { ...conversation, messageCount: conversation.messageCount || 1 },
        ...currentConversations,
      ]);
    });
  }, []);

  const handleConversationUpdated = useCallback((conversationId, updates) => {
    setConversations((currentConversations) =>
      sortConversations(
        currentConversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                ...updates,
                updated_at: updates.updated_at || new Date().toISOString(),
              }
            : conversation,
        ),
      ),
    );
  }, []);

  const handleRenameConversation = useCallback(
    async (conversationId, newTitle) => {
      if (!user) {
        throw new Error('You must be signed in to rename conversations.');
      }

      const previousConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );

      if (!previousConversation) {
        return;
      }

      const optimisticConversation = {
        ...previousConversation,
        title: newTitle,
        updated_at: new Date().toISOString(),
      };

      setConversations((currentConversations) =>
        sortConversations(
          currentConversations.map((conversation) =>
            conversation.id === conversationId ? optimisticConversation : conversation,
          ),
        ),
      );

      try {
        const updatedConversation = await renameConversation(user.id, conversationId, newTitle);
        handleConversationUpdated(conversationId, updatedConversation);
      } catch (error) {
        setConversations((currentConversations) =>
          sortConversations(
            currentConversations.map((conversation) =>
              conversation.id === conversationId ? previousConversation : conversation,
            ),
          ),
        );
        throw error;
      }
    },
    [conversations, handleConversationUpdated, user],
  );

  const handleDeleteConversation = useCallback(
    async (conversationId) => {
      if (!user) {
        throw new Error('You must be signed in to delete conversations.');
      }

      const previousConversations = conversations;

      setConversations((currentConversations) =>
        currentConversations.filter((conversation) => conversation.id !== conversationId),
      );

      try {
        await deleteConversation(user.id, conversationId);
      } catch (error) {
        setConversations(previousConversations);
        throw error;
      }
    },
    [conversations, user],
  );

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // Show loading screen while checking auth state
  // This prevents redirecting to login before OAuth callback is processed
  if (authLoading || (user && personaLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show public pages
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // If authenticated, show app with sidebar
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
      {/* Persona Selection Modal - shows when user hasn't selected a persona */}
      {user && !hasCompletedSetup && <PersonaSelectionModal />}

      {/* Overlay when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - hidden by default, shown when sidebarOpen is true */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          conversations={conversations}
          theme={theme}
          toggleTheme={toggleTheme}
          loading={loadingConversations}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onClose={() => setSidebarOpen(false)}
          isMobileOpen={sidebarOpen}
        />
      </div>

      <main className="flex-1 flex flex-col relative h-full min-h-0 overflow-hidden">
        {/* Header with sidebar toggle */}
        <div className="flex-shrink-0 border-b border-border bg-card/50">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center w-11 h-11 -ml-2 neu-btn rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-semibold text-foreground">VisuaLearn</span>
            <div className="w-11 h-11" />
          </div>
        </div>

        <Routes>
          <Route path="/" element={<Navigate to="/chat/new" replace />} />
          <Route
            path="/chat/new"
            element={
              <NewChatPage
                onConversationCreated={handleConversationCreated}
                onConversationUpdated={handleConversationUpdated}
              />
            }
          />
          <Route
            path="/chat/:id"
            element={
              <ProtectedRoute>
                <ChatWindow
                  onConversationCreated={handleConversationCreated}
                  onConversationUpdated={handleConversationUpdated}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learn/:id"
            element={
              <ProtectedRoute>
                <LearningPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/chat/new" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/**
 * App: Main component with AuthProvider and PersonaProvider
 */
function App() {
  return (
    <AuthProvider>
      <PersonaProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </PersonaProvider>
    </AuthProvider>
  );
}

export default App;
