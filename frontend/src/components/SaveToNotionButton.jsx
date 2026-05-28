import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { exportToNotion, getNotionConnectUrl, getNotionStatus } from "../services/notionService";
import { BLOCK_LABELS } from "../utils/contentBlocks";

const DEFAULT_EXPORT_ARTIFACTS = [
  "learn",
  "quiz",
  "flashcards",
  "mindmap",
  "simulation",
  "transcript",
];

const CHAT_BLOCK_EXPORT_TYPES = ["flashcards", "mindmap", "simulation"];

function getActiveConversationId(pathname) {
  const match = pathname.match(/^\/(?:chat|learn)\/([^/?#]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

export default function SaveToNotionButton({
  mode = null,
  scope = null,
  messageId = null,
  availableBlockTypes = [],
  compact = false,
  className = "",
}) {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState({ busy: false, message: "", url: "" });
  const [showOptions, setShowOptions] = useState(false);
  const [selectedBlockTypes, setSelectedBlockTypes] = useState([]);

  const conversationId = useMemo(
    () => getActiveConversationId(location.pathname),
    [location.pathname],
  );

  const resolvedMode = mode || (location.pathname.startsWith("/learn/") ? "learning" : "chat");
  const resolvedScope = scope || (resolvedMode === "learning" ? "workspace" : messageId ? "response" : "conversation");
  const blockTypes = useMemo(
    () => [...new Set((availableBlockTypes || []).filter(Boolean))],
    [availableBlockTypes],
  );

  const options = useMemo(() => buildSaveOptions({
    mode: resolvedMode,
    scope: resolvedScope,
    messageId,
    blockTypes,
  }), [blockTypes, messageId, resolvedMode, resolvedScope]);

  const handleOpen = () => {
    setState(previous => ({ ...previous, message: "", url: "" }));

    if (!session?.access_token) {
      setState({ busy: false, message: "Sign in again to save.", url: "" });
      return;
    }

    if (!conversationId) {
      setState({ busy: false, message: "Open a saved chat first.", url: "" });
      return;
    }

    setSelectedBlockTypes(blockTypes);

    if (options.length <= 1 && blockTypes.length <= 1) {
      handleSave(options[0]);
      return;
    }

    setShowOptions(true);
  };

  const handleSave = async (option) => {
    setShowOptions(false);
    setState({ busy: true, message: "Checking Notion...", url: "" });

    try {
      const status = await getNotionStatus(session.access_token);
      if (status.configured === false) {
        setState({ busy: false, message: "Complete Notion setup in Settings.", url: "" });
        navigate("/settings");
        return;
      }

      if (!status.connected) {
        const { url } = await getNotionConnectUrl(session.access_token);
        window.location.href = url;
        return;
      }

      setState({ busy: true, message: "Saving...", url: "" });
      const result = await exportToNotion(session.access_token, {
        conversationId,
        mode: option.mode,
        scope: option.scope,
        messageId: option.messageId || null,
        blockTypes: option.blockTypes || [],
        blockIds: option.blockIds || [],
        artifactTypes: DEFAULT_EXPORT_ARTIFACTS,
      });

      setState({
        busy: false,
        message: "Saved to Notion.",
        url: result.url || "",
      });
    } catch (error) {
      setState({
        busy: false,
        message: error.message || "Save failed.",
        url: "",
      });
    }
  };

  const buttonClassName = compact
    ? `inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 ${className}`
    : `inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${className}`;

  return (
    <div className="relative flex items-center gap-2">
      {state.url && (
        <a
          href={state.url}
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex text-xs font-medium text-primary hover:underline"
        >
          Open
        </a>
      )}
      <button
        type="button"
        onClick={handleOpen}
        disabled={state.busy}
        className={buttonClassName}
        title={state.message || saveTitle(resolvedMode, resolvedScope)}
        aria-label={saveTitle(resolvedMode, resolvedScope)}
      >
        <SaveIcon />
        {!compact && (
          <span className="hidden sm:inline">{state.busy ? "Saving..." : "Save to Notion"}</span>
        )}
      </button>
      {state.message && !state.busy && !compact && (
        <span className="hidden max-w-[180px] truncate text-[11px] text-muted-foreground lg:inline" title={state.message}>
          {state.message}
        </span>
      )}

      {showOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setShowOptions(false)}>
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Save to Notion</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose what should be organized in your Notion workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOptions(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            {messageId && blockTypes.length > 1 && (
              <div className="mb-3 rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium text-foreground">Selected blocks</p>
                <div className="mt-2 space-y-2">
                  {blockTypes.map(type => (
                    <label key={type} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selectedBlockTypes.includes(type)}
                        onChange={() => {
                          setSelectedBlockTypes(previous => previous.includes(type)
                            ? previous.filter(item => item !== type)
                            : [...previous, type]);
                        }}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span>{BLOCK_LABELS[type] || type}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!selectedBlockTypes.length}
                  onClick={() => handleSave({
                    id: "selected-blocks",
                    label: "Save Selected Blocks",
                    mode: "chat",
                    scope: "blocks",
                    messageId,
                    blockTypes: selectedBlockTypes,
                  })}
                  className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Selected Blocks
                </button>
              </div>
            )}

            <div className="space-y-2">
              {options.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSave(option)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SaveIcon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildSaveOptions({ mode, scope, messageId, blockTypes }) {
  if (mode === "learning") {
    return [{
      id: "workspace",
      label: "Save Entire Workspace",
      description: "Export the complete topic workspace with notes, quiz, flashcards, mind map, and simulations.",
      mode: "learning",
      scope: "workspace",
    }];
  }

  if (!messageId) {
    return [{
      id: "chat",
      label: "Save Entire Chat",
      description: "Export the ordered conversation with prompts, responses, and generated learning blocks.",
      mode: "chat",
      scope: "conversation",
    }];
  }

  const options = [{
    id: "response",
    label: "Save Current Response",
    description: "Export this assistant response and all content blocks attached to it.",
    mode: "chat",
    scope: scope || "response",
    messageId,
  }];

  for (const type of CHAT_BLOCK_EXPORT_TYPES) {
    if (!blockTypes.includes(type)) continue;
    options.push({
      id: type,
      label: `Save Only ${BLOCK_LABELS[type] || type}`,
      description: `Export only the ${BLOCK_LABELS[type] || type} from this response.`,
      mode: "chat",
      scope: "blocks",
      messageId,
      blockTypes: [type],
    });
  }

  return options;
}

function saveTitle(mode, scope) {
  if (mode === "learning") return "Save learning workspace to Notion";
  if (scope === "response") return "Save this response to Notion";
  return "Save current chat to Notion";
}

function SaveIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h12l4 4v12H4z" />
      <path d="M14 4v6h6" />
      <path d="M8 15h8" />
      <path d="M8 18h5" />
    </svg>
  );
}
