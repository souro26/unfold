import { Settings, LLMProvider } from '../types';
import { getSettings, saveSettings } from '../services/ipc';
import { escapeHtml } from '../utils/helpers';

export class SettingsModalComponent {
  private modalEl: HTMLElement | null = null;
  private onSavedCallback?: () => void;

  constructor(onSaved?: () => void) {
    this.onSavedCallback = onSaved;
  }

  public async open(): Promise<void> {
    this.close();

    let settings: Settings;
    try {
      settings = await getSettings();
    } catch {
      settings = {
        llm_provider: 'gemini',
        api_key: '',
        model: 'gemini-1.5-flash',
        temperature: 0.7,
        max_tokens: 4096,
      };
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'settingsModal';

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>Settings</h2>
          <button class="modal-close-btn" id="closeSettingsBtn" aria-label="Close settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="settings-form">
          <div class="form-group">
            <label for="providerSelect">LLM Provider</label>
            <select id="providerSelect" class="setting-select">
              <option value="gemini" ${settings.llm_provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
              <option value="groq" ${settings.llm_provider === 'groq' ? 'selected' : ''}>Groq</option>
              <option value="openai" ${settings.llm_provider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="ollama" ${settings.llm_provider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="modelInput">Model Name</label>
            <input type="text" id="modelInput" class="setting-input" value="${escapeHtml(settings.model || 'gemini-1.5-flash')}" placeholder="e.g. gemini-1.5-flash" />
          </div>
          <div class="form-group">
            <label for="apiKeyInput">API Key</label>
            <input type="password" id="apiKeyInput" class="setting-input" value="${escapeHtml(settings.api_key || '')}" placeholder="Enter your API key" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="cancelSettingsBtn">Cancel</button>
          <button class="btn-primary" id="saveSettingsBtn">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;

    // Event listeners
    overlay.querySelector('#closeSettingsBtn')?.addEventListener('click', () => this.close());
    overlay.querySelector('#cancelSettingsBtn')?.addEventListener('click', () => this.close());
    overlay.querySelector('#saveSettingsBtn')?.addEventListener('click', () => this.save());

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  private async save(): Promise<void> {
    if (!this.modalEl) return;
    const providerSelect = this.modalEl.querySelector('#providerSelect') as HTMLSelectElement;
    const modelInput = this.modalEl.querySelector('#modelInput') as HTMLInputElement;
    const apiKeyInput = this.modalEl.querySelector('#apiKeyInput') as HTMLInputElement;

    const newSettings: Settings = {
      llm_provider: (providerSelect.value as LLMProvider) || 'gemini',
      model: modelInput.value.trim() || 'gemini-1.5-flash',
      api_key: apiKeyInput.value.trim() || null,
      temperature: 0.7,
      max_tokens: 4096,
    };

    try {
      await saveSettings(newSettings);
      this.close();
      if (this.onSavedCallback) {
        this.onSavedCallback();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings: ' + String(err));
    }
  }

  public close(): void {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }

  public isOpen(): boolean {
    return !!this.modalEl;
  }
}
