import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePersona } from '../contexts/PersonaContext';
import PersonaCard from '../components/PersonaCard';
import PersonaEditor from '../components/PersonaEditor';
import { disconnectNotion, getNotionConnectUrl, getNotionStatus } from '../services/notionService';

/**
 * SettingsPage: User settings including persona management
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const {
    systemPersonas,
    customPersonas,
    defaultPersona,
    selectDefaultPersona,
    createPersona,
    updatePersona,
    deletePersona,
    isLoading,
  } = usePersona();

  const [showEditor, setShowEditor] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [notionStatus, setNotionStatus] = useState({ connected: false, configured: true });
  const [isNotionLoading, setIsNotionLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    const notionResult = searchParams.get('notion');
    const notionMessage = searchParams.get('message');
    if (notionResult === 'connected') {
      setSuccessMessage('Notion connected successfully');
      setSearchParams({}, { replace: true });
    } else if (notionResult === 'error') {
      setError(notionMessage || 'Notion connection failed');
      setSearchParams({}, { replace: true });
    }

    refreshNotionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const refreshNotionStatus = async () => {
    if (!accessToken) return;
    try {
      setIsNotionLoading(true);
      const status = await getNotionStatus(accessToken);
      setNotionStatus(status);
    } catch (err) {
      setNotionStatus({
        connected: false,
        configured: false,
        missing: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET', 'NOTION_TOKEN_ENCRYPTION_KEY'],
        error: err.message,
      });
    } finally {
      setIsNotionLoading(false);
    }
  };

  const handleSelectDefault = async (persona) => {
    try {
      setError(null);
      await selectDefaultPersona(persona.id);
      setSuccessMessage(`${persona.name} is now your default persona`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (persona) => {
    setEditingPersona(persona);
    setShowEditor(true);
  };

  const handleDelete = async (persona) => {
    if (!confirm(`Are you sure you want to delete "${persona.name}"?`)) return;

    try {
      setError(null);
      await deletePersona(persona.id);
      setSuccessMessage(`${persona.name} deleted`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSavePersona = async (formData) => {
    setIsSaving(true);
    setError(null);

    try {
      if (editingPersona) {
        await updatePersona(editingPersona.id, formData);
        setSuccessMessage(`${formData.name} updated successfully`);
      } else {
        await createPersona(formData);
        setSuccessMessage(`${formData.name} created successfully`);
      }
      setShowEditor(false);
      setEditingPersona(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditor = () => {
    setShowEditor(false);
    setEditingPersona(null);
  };

  const handleConnectNotion = async () => {
    try {
      setError(null);
      setIsNotionLoading(true);
      const { url } = await getNotionConnectUrl(accessToken);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setIsNotionLoading(false);
    }
  };

  const handleDisconnectNotion = async () => {
    try {
      setError(null);
      setIsNotionLoading(true);
      await disconnectNotion(accessToken);
      setNotionStatus({ connected: false, configured: true });
      setSuccessMessage('Notion disconnected');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsNotionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-scroll bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-20 space-y-8">
        {/* Notifications */}
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500">
            {successMessage}
          </div>
        )}

        {/* Notion Section */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Notion Export</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card p-4">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">
                  {notionStatus.connected ? 'Connected to Notion' : 'Connect your Notion workspace'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {notionStatus.connected
                    ? `Ready to export. New learning pages will be created in ${notionStatus.workspaceName || 'your Notion workspace'}.`
                    : notionStatus.configured === false
                      ? `Backend setup is incomplete. Add these server env values, restart the backend, then retry: ${(notionStatus.missing?.length ? notionStatus.missing : ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET', 'NOTION_TOKEN_ENCRYPTION_KEY']).join(', ')}.`
                      : 'Backend setup is ready. Click Connect Notion, approve access in Notion, and VisuaLearn will create a learning library database for future exports.'}
                </p>
                {!notionStatus.connected && notionStatus.configured !== false && (
                  <ol className="mt-3 list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                    <li>Click Connect Notion.</li>
                    <li>Select your workspace and allow access to the pages you want VisuaLearn to use.</li>
                    <li>After Notion redirects back, open a learning session and export it from the session actions.</li>
                  </ol>
                )}
              </div>

              {notionStatus.connected ? (
                <button
                  onClick={handleDisconnectNotion}
                  disabled={isNotionLoading}
                  className="w-full shrink-0 rounded-lg border border-border px-4 py-2 text-foreground transition-colors hover:bg-muted disabled:opacity-50 sm:w-auto"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectNotion}
                  disabled={isNotionLoading}
                  className="w-full shrink-0 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
                >
                  {isNotionLoading ? 'Connecting...' : notionStatus.configured === false ? 'Retry Notion Setup' : 'Connect Notion'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Active Persona Section */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Active Persona</h2>
          {defaultPersona ? (
            <div className="overflow-hidden rounded-xl border border-primary bg-primary/5 p-4">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="min-w-0 break-words font-semibold text-foreground">{defaultPersona.name}</h3>
                    {defaultPersona.is_system && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        System
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {defaultPersona.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {defaultPersona.tone}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {defaultPersona.verbosity}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {defaultPersona.strength}% adherence
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-primary font-medium px-2 py-1 rounded bg-primary/10">
                    Active
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-border bg-card text-center">
              <p className="text-muted-foreground">No persona selected</p>
            </div>
          )}
        </section>

        {/* System Personas Section */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">System Personas</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Pre-built personas optimized for different learning styles.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemPersonas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isSelected={defaultPersona?.id === persona.id}
                onSelect={handleSelectDefault}
              />
            ))}
          </div>
        </section>

        {/* Custom Personas Section */}
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">Custom Personas</h2>
              <p className="text-sm text-muted-foreground">
                Create your own personas with custom rules and styles.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingPersona(null);
                setShowEditor(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Persona
            </button>
          </div>

          {customPersonas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customPersonas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  isSelected={defaultPersona?.id === persona.id}
                  onSelect={handleSelectDefault}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  showActions
                />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-border bg-card text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-muted-foreground mb-2">No custom personas yet</p>
              <p className="text-sm text-muted-foreground">
                Create a persona tailored to your learning preferences
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">
                {editingPersona ? 'Edit Persona' : 'Create Persona'}
              </h2>
            </div>
            <div className="p-6">
              <PersonaEditor
                persona={editingPersona}
                onSave={handleSavePersona}
                onCancel={handleCancelEditor}
                isSaving={isSaving}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
