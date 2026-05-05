/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as personaService from '../services/personaService';

/**
 * PersonaContext: Manages AI persona state
 * Provides personas, default persona, and CRUD operations
 */
const PersonaContext = createContext(null);

export function PersonaProvider({ children }) {
  const { session, user, isLoading: authLoading } = useAuth();

  const [personas, setPersonas] = useState([]);
  const [systemPersonas, setSystemPersonas] = useState([]);
  const [customPersonas, setCustomPersonas] = useState([]);
  const [defaultPersona, setDefaultPersona] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Computed: has user completed persona setup?
  const hasCompletedSetup = Boolean(defaultPersona);

  /**
   * Fetch all personas and default persona
   */
  const fetchPersonas = useCallback(async () => {
    if (!session || !user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all personas and default in parallel
      const [allPersonasResult, defaultResult] = await Promise.allSettled([
        personaService.getPersonas(session),
        personaService.getDefaultPersona(session),
      ]);

      // Handle personas result
      if (allPersonasResult.status === 'fulfilled') {
        setPersonas(allPersonasResult.value.personas || []);
        setSystemPersonas(allPersonasResult.value.systemPersonas || []);
        setCustomPersonas(allPersonasResult.value.customPersonas || []);
      } else {
        console.warn('[PersonaContext] Personas not available:', allPersonasResult.reason?.message);
        // Continue without personas - feature gracefully degrades
      }

      // Handle default persona result
      if (defaultResult.status === 'fulfilled') {
        setDefaultPersona(defaultResult.value.persona || null);
      } else {
        console.warn('[PersonaContext] Default persona not available:', defaultResult.reason?.message);
      }
    } catch (err) {
      console.warn('[PersonaContext] Persona feature unavailable:', err.message);
      // Don't set error state - let the app continue without personas
    } finally {
      setIsLoading(false);
    }
  }, [session, user]);

  // Fetch personas when user is authenticated
  useEffect(() => {
    if (!authLoading && user && session) {
      fetchPersonas();
    } else if (!authLoading && !user) {
      // Reset state when logged out
      setPersonas([]);
      setSystemPersonas([]);
      setCustomPersonas([]);
      setDefaultPersona(null);
      setIsLoading(false);
    }
  }, [authLoading, user, session, fetchPersonas]);

  /**
   * Set user's default persona
   */
  const selectDefaultPersona = useCallback(async (personaId) => {
    if (!session) throw new Error('Not authenticated');

    try {
      const result = await personaService.setDefaultPersona(session, personaId);
      setDefaultPersona(result.persona);
      return result;
    } catch (err) {
      console.error('[PersonaContext] Failed to set default persona:', err);
      throw err;
    }
  }, [session]);

  /**
   * Create a new custom persona
   */
  const createPersona = useCallback(async (personaData) => {
    if (!session) throw new Error('Not authenticated');

    try {
      const result = await personaService.createPersona(session, personaData);

      // Update local state
      setCustomPersonas(prev => [...prev, result.persona]);
      setPersonas(prev => [...prev, result.persona]);

      return result.persona;
    } catch (err) {
      console.error('[PersonaContext] Failed to create persona:', err);
      throw err;
    }
  }, [session]);

  /**
   * Update an existing persona
   */
  const updatePersona = useCallback(async (personaId, updates) => {
    if (!session) throw new Error('Not authenticated');

    try {
      const result = await personaService.updatePersona(session, personaId, updates);

      // Update local state
      const updateInList = (list) =>
        list.map(p => p.id === personaId ? result.persona : p);

      setPersonas(updateInList);
      setCustomPersonas(updateInList);

      // Update default if it was the one being edited
      if (defaultPersona?.id === personaId) {
        setDefaultPersona(result.persona);
      }

      return result.persona;
    } catch (err) {
      console.error('[PersonaContext] Failed to update persona:', err);
      throw err;
    }
  }, [session, defaultPersona]);

  /**
   * Delete a custom persona
   */
  const deletePersona = useCallback(async (personaId) => {
    if (!session) throw new Error('Not authenticated');

    try {
      await personaService.deletePersona(session, personaId);

      // Update local state
      setCustomPersonas(prev => prev.filter(p => p.id !== personaId));
      setPersonas(prev => prev.filter(p => p.id !== personaId));

      // If deleted persona was default, re-fetch to get new default
      if (defaultPersona?.id === personaId) {
        const defaultResult = await personaService.getDefaultPersona(session);
        setDefaultPersona(defaultResult.persona || null);
      }
    } catch (err) {
      console.error('[PersonaContext] Failed to delete persona:', err);
      throw err;
    }
  }, [session, defaultPersona]);

  /**
   * Refresh personas from server
   */
  const refresh = useCallback(() => {
    return fetchPersonas();
  }, [fetchPersonas]);

  const value = {
    // State
    personas,
    systemPersonas,
    customPersonas,
    defaultPersona,
    isLoading,
    error,
    hasCompletedSetup,

    // Actions
    selectDefaultPersona,
    createPersona,
    updatePersona,
    deletePersona,
    refresh,
  };

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

/**
 * Hook: usePersona
 * Access persona state anywhere in the app
 */
export function usePersona() {
  const context = useContext(PersonaContext);

  if (!context) {
    throw new Error('usePersona must be used within PersonaProvider');
  }

  return context;
}

export default PersonaProvider;
