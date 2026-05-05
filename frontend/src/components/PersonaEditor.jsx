import { useState, useEffect } from 'react';

const TONES = [
  { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { value: 'formal', label: 'Formal', description: 'Professional and structured' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' },
  { value: 'technical', label: 'Technical', description: 'Precise and detailed' },
  { value: 'encouraging', label: 'Encouraging', description: 'Supportive and motivating' },
  { value: 'rigorous', label: 'Rigorous', description: 'Challenging and thorough' },
];

const VERBOSITY_OPTIONS = [
  { value: 'concise', label: 'Concise', description: 'Brief, to-the-point responses' },
  { value: 'medium', label: 'Medium', description: 'Balanced explanations' },
  { value: 'detailed', label: 'Detailed', description: 'Comprehensive, thorough responses' },
];

const MAX_RULES = 5;
const MAX_RULE_LENGTH = 200;

/**
 * PersonaEditor: Form for creating/editing personas
 */
export default function PersonaEditor({
  persona = null, // null for create, object for edit
  onSave,
  onCancel,
  isSaving = false,
}) {
  const isEditing = !!persona;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt_prefix: '',
    tone: 'friendly',
    verbosity: 'medium',
    strength: 80,
    rules: [],
    avoid_rules: [],
  });

  const [newRule, setNewRule] = useState('');
  const [newAvoidRule, setNewAvoidRule] = useState('');
  const [errors, setErrors] = useState({});

  // Initialize form with persona data if editing
  useEffect(() => {
    if (persona) {
      setFormData({
        name: persona.name || '',
        description: persona.description || '',
        system_prompt_prefix: persona.system_prompt_prefix || '',
        tone: persona.tone || 'friendly',
        verbosity: persona.verbosity || 'medium',
        strength: persona.strength ?? 80,
        rules: persona.rules || [],
        avoid_rules: persona.avoid_rules || [],
      });
    }
  }, [persona]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const addRule = () => {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    if (formData.rules.length >= MAX_RULES) {
      setErrors(prev => ({ ...prev, rules: `Maximum ${MAX_RULES} rules allowed` }));
      return;
    }
    if (trimmed.length > MAX_RULE_LENGTH) {
      setErrors(prev => ({ ...prev, rules: `Rule must be ${MAX_RULE_LENGTH} characters or less` }));
      return;
    }
    setFormData(prev => ({ ...prev, rules: [...prev.rules, trimmed] }));
    setNewRule('');
    setErrors(prev => ({ ...prev, rules: null }));
  };

  const removeRule = (index) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const addAvoidRule = () => {
    const trimmed = newAvoidRule.trim();
    if (!trimmed) return;
    if (formData.avoid_rules.length >= MAX_RULES) {
      setErrors(prev => ({ ...prev, avoid_rules: `Maximum ${MAX_RULES} rules allowed` }));
      return;
    }
    if (trimmed.length > MAX_RULE_LENGTH) {
      setErrors(prev => ({ ...prev, avoid_rules: `Rule must be ${MAX_RULE_LENGTH} characters or less` }));
      return;
    }
    setFormData(prev => ({ ...prev, avoid_rules: [...prev.avoid_rules, trimmed] }));
    setNewAvoidRule('');
    setErrors(prev => ({ ...prev, avoid_rules: null }));
  };

  const removeAvoidRule = (index) => {
    setFormData(prev => ({
      ...prev,
      avoid_rules: prev.avoid_rules.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }

    if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    if (formData.system_prompt_prefix.length > 2000) {
      newErrors.system_prompt_prefix = 'Prompt prefix must be 2000 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., My Custom Tutor"
          className={`
            w-full px-3 py-2 rounded-lg border bg-background text-foreground
            focus:outline-none focus:ring-2 focus:ring-primary/50
            ${errors.name ? 'border-red-500' : 'border-border'}
          `}
          maxLength={100}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe this persona's teaching style..."
          rows={2}
          className={`
            w-full px-3 py-2 rounded-lg border bg-background text-foreground resize-none
            focus:outline-none focus:ring-2 focus:ring-primary/50
            ${errors.description ? 'border-red-500' : 'border-border'}
          `}
          maxLength={500}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          {errors.description && <span className="text-red-500">{errors.description}</span>}
          <span className="ml-auto">{formData.description.length}/500</span>
        </div>
      </div>

      {/* Tone & Verbosity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Tone
          </label>
          <div className="space-y-2">
            {TONES.map((tone) => (
              <label
                key={tone.value}
                className={`
                  flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors
                  ${formData.tone === tone.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                  }
                `}
              >
                <input
                  type="radio"
                  name="tone"
                  value={tone.value}
                  checked={formData.tone === tone.value}
                  onChange={(e) => handleChange('tone', e.target.value)}
                  className="sr-only"
                />
                <div
                  className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center
                    ${formData.tone === tone.value ? 'border-primary' : 'border-muted-foreground'}
                  `}
                >
                  {formData.tone === tone.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">{tone.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{tone.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Verbosity
          </label>
          <div className="space-y-2">
            {VERBOSITY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`
                  flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors
                  ${formData.verbosity === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                  }
                `}
              >
                <input
                  type="radio"
                  name="verbosity"
                  value={option.value}
                  checked={formData.verbosity === option.value}
                  onChange={(e) => handleChange('verbosity', e.target.value)}
                  className="sr-only"
                />
                <div
                  className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center
                    ${formData.verbosity === option.value ? 'border-primary' : 'border-muted-foreground'}
                  `}
                >
                  {formData.verbosity === option.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Strength slider */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Adherence Strength: {formData.strength}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={formData.strength}
          onChange={(e) => handleChange('strength', parseInt(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Flexible (adapts to you)</span>
          <span>Strict (follows rules)</span>
        </div>
      </div>

      {/* Rules (MUST DO) */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Rules (MUST DO) - {formData.rules.length}/{MAX_RULES}
        </label>
        <div className="space-y-2 mb-2">
          {formData.rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20"
            >
              <span className="text-green-500">+</span>
              <span className="text-sm text-foreground flex-1">{rule}</span>
              <button
                type="button"
                onClick={() => removeRule(index)}
                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
            placeholder="Add a rule (e.g., Use simple analogies)"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            maxLength={MAX_RULE_LENGTH}
            disabled={formData.rules.length >= MAX_RULES}
          />
          <button
            type="button"
            onClick={addRule}
            disabled={formData.rules.length >= MAX_RULES}
            className="px-3 py-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        {errors.rules && <p className="text-red-500 text-xs mt-1">{errors.rules}</p>}
      </div>

      {/* Avoid Rules (MUST AVOID) */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Avoid Rules (MUST AVOID) - {formData.avoid_rules.length}/{MAX_RULES}
        </label>
        <div className="space-y-2 mb-2">
          {formData.avoid_rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <span className="text-red-500">-</span>
              <span className="text-sm text-foreground flex-1">{rule}</span>
              <button
                type="button"
                onClick={() => removeAvoidRule(index)}
                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newAvoidRule}
            onChange={(e) => setNewAvoidRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAvoidRule())}
            placeholder="Add an avoid rule (e.g., Don't use jargon)"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            maxLength={MAX_RULE_LENGTH}
            disabled={formData.avoid_rules.length >= MAX_RULES}
          />
          <button
            type="button"
            onClick={addAvoidRule}
            disabled={formData.avoid_rules.length >= MAX_RULES}
            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        {errors.avoid_rules && <p className="text-red-500 text-xs mt-1">{errors.avoid_rules}</p>}
      </div>

      {/* Custom Prompt Prefix (Advanced) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          Advanced: Custom Prompt Prefix
        </summary>
        <div className="mt-2">
          <textarea
            value={formData.system_prompt_prefix}
            onChange={(e) => handleChange('system_prompt_prefix', e.target.value)}
            placeholder="Additional instructions to inject into the system prompt..."
            rows={3}
            className={`
              w-full px-3 py-2 rounded-lg border bg-background text-foreground resize-none text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/50
              ${errors.system_prompt_prefix ? 'border-red-500' : 'border-border'}
            `}
            maxLength={2000}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            {errors.system_prompt_prefix && (
              <span className="text-red-500">{errors.system_prompt_prefix}</span>
            )}
            <span className="ml-auto">{formData.system_prompt_prefix.length}/2000</span>
          </div>
        </div>
      </details>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : isEditing ? (
            'Save Changes'
          ) : (
            'Create Persona'
          )}
        </button>
      </div>
    </form>
  );
}
