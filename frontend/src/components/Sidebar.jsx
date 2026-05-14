import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "../lib/supabase";
import {
  MAX_CONVERSATION_TITLE_LENGTH,
  normalizeConversationTitle,
} from "../utils/conversationActions";

export default function Sidebar({
  conversations,
  theme,
  toggleTheme,
  loading = false,
  onRenameConversation = null,
  onDeleteConversation = null,
  onClose = null,
  isMobileOpen = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [renameConversationId, setRenameConversationId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [busyConversationId, setBusyConversationId] = useState(null);
  const [inlineError, setInlineError] = useState("");
  const deleteContainerRef = useRef(null);

  useEffect(() => {
    if (!inlineError) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setInlineError(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [inlineError]);

  useEffect(() => {
    if (!pendingDeleteId) {
      return undefined;
    }

    function handleOutsideClick(event) {
      if (!deleteContainerRef.current?.contains(event.target)) {
        setPendingDeleteId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [pendingDeleteId]);

  const clearModes = () => {
    setRenameConversationId(null);
    setRenameValue("");
    setPendingDeleteId(null);
  };

  const handleRenameStart = (conversation) => {
    setInlineError("");
    setPendingDeleteId(null);
    setRenameConversationId(conversation.id);
    setRenameValue(conversation.title || "");
  };

  const handleRenameCancel = () => {
    setRenameConversationId(null);
    setRenameValue("");
  };

  const handleRenameSubmit = async (conversation) => {
    const normalizedTitle = normalizeConversationTitle(renameValue);

    if (!normalizedTitle) {
      handleRenameCancel();
      return;
    }

    if (normalizedTitle === conversation.title) {
      handleRenameCancel();
      return;
    }

    setBusyConversationId(conversation.id);

    try {
      await onRenameConversation?.(conversation.id, normalizedTitle);
      handleRenameCancel();
    } catch {
      setInlineError("Rename failed");
      setRenameValue(conversation.title || "");
      handleRenameCancel();
    } finally {
      setBusyConversationId(null);
    }
  };

  const handleDeleteStart = (conversationId) => {
    setInlineError("");
    setRenameConversationId(null);
    setRenameValue("");
    setPendingDeleteId(conversationId);
  };

  const handleDeleteConfirm = async (conversationId) => {
    const remainingConversations = conversations.filter(
      (conversation) => conversation.id !== conversationId,
    );
    const nextConversation = remainingConversations[0] || null;
    const isActiveConversation =
      location.pathname === `/learn/${conversationId}` ||
      location.pathname === `/chat/${conversationId}`;

    setBusyConversationId(conversationId);

    try {
      await onDeleteConversation?.(conversationId);
      setPendingDeleteId(null);

      if (isActiveConversation) {
        navigate(nextConversation ? `/learn/${nextConversation.id}` : "/chat/new");
      }
    } catch {
      setInlineError("Delete failed");
    } finally {
      setBusyConversationId(null);
    }
  };

  return (
    <aside className="w-[304px] h-full bg-sidebar/95 flex flex-col pt-5 pb-5 border-r border-sidebar-border shadow-[18px_0_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
      <div className="px-5 mb-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group min-h-[44px]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <span className="block font-bold text-sidebar-foreground text-[15px] tracking-tight group-hover:text-primary transition-colors">
              VisuaLearn AI
            </span>
            <span className="block text-[11px] text-muted-foreground">Structured learning system</span>
          </div>
        </Link>
        {/* Mobile close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 -mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-4 mb-5">
        <button
          onClick={() => {
            clearModes();
            navigate("/chat/new");
            onClose?.();
          }}
          className="w-full flex items-center justify-center gap-2 neu-btn-primary px-3 min-h-[44px] text-sm font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
          </svg>
          New Learning Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <p className="text-[10px] font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-widest">
          Recent Sessions
        </p>

        {inlineError && (
          <div className="mx-2 mb-2 rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {inlineError}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {loading ? (
            <p className="text-[12px] text-muted-foreground px-2 py-1">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="text-[12px] text-muted-foreground px-2 py-1">No sessions yet</p>
          ) : (
            conversations.map((conversation) => {
              const isActive =
                location.pathname === `/learn/${conversation.id}` ||
                location.pathname === `/chat/${conversation.id}`;
              const isRenaming = renameConversationId === conversation.id;
              const isDeleteConfirming = pendingDeleteId === conversation.id;
              const isBusy = busyConversationId === conversation.id;

              return (
                <div
                  key={conversation.id}
                  ref={isDeleteConfirming ? deleteContainerRef : null}
                  data-conversation-item-id={conversation.id}
                  className={`group/item rounded-xl px-2.5 py-2 min-h-[44px] transition-all ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  {isDeleteConfirming ? (
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1 text-[12px] text-foreground">
                        <p className="truncate font-medium">Delete this session?</p>
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteConfirm(conversation.id)}
                        className="rounded px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setPendingDeleteId(null)}
                        className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                      >
                        No
                      </button>
                    </div>
                  ) : isRenaming ? (
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </span>
                      <input
                        autoFocus
                        value={renameValue}
                        maxLength={MAX_CONVERSATION_TITLE_LENGTH}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={() => handleRenameSubmit(conversation)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleRenameSubmit(conversation);
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            handleRenameCancel();
                          }
                        }}
                        className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        data-conversation-action="rename-confirm"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleRenameSubmit(conversation)}
                        disabled={isBusy}
                        className="flex h-6 w-6 items-center justify-center rounded text-primary hover:bg-primary/10 disabled:opacity-50"
                        title="Save title"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        data-conversation-action="rename-cancel"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={handleRenameCancel}
                        disabled={isBusy}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-50"
                        title="Cancel rename"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/learn/${conversation.id}`)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 4h13a4 4 0 0 1 4 4v13H7a4 4 0 0 0-4 4z" />
                            <path d="M7 21V8a4 4 0 0 1 4-4h9" />
                          </svg>
                        </span>
                        <span className="truncate text-[13px] font-medium">
                          {conversation.title}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleRenameStart(conversation)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg neu-btn-sm text-foreground/70 hover:text-primary"
                          title="Rename session"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStart(conversation.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg neu-btn-sm text-foreground/70 hover:text-destructive"
                          title="Delete session"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="px-4 pt-4 mt-auto space-y-3">
        {user && (
          <div className="neu-pressed-sm p-2.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">
              Account
            </p>
            <p className="text-[13px] text-sidebar-foreground truncate font-medium">
              {user.email}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center neu-btn rounded-xl"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.9 13.4A8 8 0 1 1 10.6 3.1 6.5 6.5 0 1 0 20.9 13.4Z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => {
              navigate("/settings");
              onClose?.();
            }}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center neu-btn rounded-xl text-muted-foreground hover:text-foreground"
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          <button
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
            className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-destructive neu-btn px-3 min-h-[44px]"
            title="Sign out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
