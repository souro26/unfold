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
              <option value="nvidia" ${settings.llm_provider === 'nvidia' ? 'selected' : ''}>NVIDIA NIM (Free Open Source Models)</option>
              <option value="gemini" ${settings.llm_provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
              <option value="groq" ${settings.llm_provider === 'groq' ? 'selected' : ''}>Groq</option>
              <option value="openai" ${settings.llm_provider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="ollama" ${settings.llm_provider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
              <option value="llama_cpp" ${settings.llm_provider === 'llama_cpp' ? 'selected' : ''}>llama.cpp Sidecar (Local)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="modelInput">Teaching / Chat Model (The Brain)</label>
            <input type="text" id="modelInput" class="setting-input" value="${escapeHtml(settings.model && !settings.model.includes('llama-3.3-70b') ? settings.model : 'nvidia/nemotron-3.5-bolt-e4b')}" placeholder="e.g. nvidia/nemotron-3.5-bolt-e4b" />
            <span class="setting-hint" style="font-size:11px;color:var(--text-muted);margin-top:2px;display:block;">
              NVIDIA options: <code>nvidia/nemotron-3.5-bolt-e4b</code>, <code>nvidia/nemotron-3-ultra-550b-a55b</code>
            </span>
          </div>
          <div class="form-group">
            <label for="visionModelInput">Screen Vision Model (The Eyes)</label>
            <input type="text" id="visionModelInput" class="setting-input" value="${escapeHtml(settings.vision_model || 'nvidia/nemotron-3.5-super-vl-120b-a12b')}" placeholder="e.g. nvidia/nemotron-3.5-super-vl-120b-a12b" />
            <span class="setting-hint" style="font-size:11px;color:var(--text-muted);margin-top:2px;display:block;">
              Used for Screen Teach & UI reasoning: <code>nvidia/nemotron-3.5-super-vl-120b-a12b</code>, <code>nvidia/nemotron-3.5-parse</code>
            </span>
          </div>
          <div class="form-group">
            <label for="ttsSelect">Voice Narration Engine (The Voice)</label>
            <select id="ttsSelect" class="setting-select">
              <option value="nvidia" ${settings.tts_provider !== 'system' ? 'selected' : ''}>NVIDIA Neural TTS (nvidia/magpie-tts-zeroshot - Natural)</option>
              <option value="system" ${settings.tts_provider === 'system' ? 'selected' : ''}>Local System Speech (Windows Speech Synthesis)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="apiKeyInput" id="apiKeyLabel">API Key</label>
            <input type="password" id="apiKeyInput" class="setting-input" value="${escapeHtml(settings.api_key || '')}" placeholder="Enter your API key" />
            <span class="setting-hint" id="apiKeyHint" style="font-size:11px;color:var(--text-muted);margin-top:4px;display:block;"></span>
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

    const providerSelect = overlay.querySelector('#providerSelect') as HTMLSelectElement;
    const modelInput = overlay.querySelector('#modelInput') as HTMLInputElement;
    const visionModelInput = overlay.querySelector('#visionModelInput') as HTMLInputElement;
    const ttsSelect = overlay.querySelector('#ttsSelect') as HTMLSelectElement;
    const apiKeyHint = overlay.querySelector('#apiKeyHint') as HTMLElement;
    const apiKeyInput = overlay.querySelector('#apiKeyInput') as HTMLInputElement;

    const updateProviderHints = () => {
      const val = providerSelect.value;
      if (val === 'nvidia') {
        apiKeyHint.innerHTML = 'One free API key powers Brain, Vision, and Voice! Get key at <a href="https://build.nvidia.com" target="_blank" style="color:var(--accent-teal, #00d4aa);text-decoration:underline;">build.nvidia.com</a>';
        apiKeyInput.placeholder = 'nvapi-...';
        if (!modelInput.value || modelInput.value.includes('gemini') || modelInput.value.includes('llama') || modelInput.value === 'llama3') {
          modelInput.value = 'nvidia/nemotron-3.5-bolt-e4b';
        }
        if (!visionModelInput.value || visionModelInput.value.includes('gemini')) {
          visionModelInput.value = 'nvidia/nemotron-3.5-super-vl-120b-a12b';
        }
        if (ttsSelect.value === 'system') {
          ttsSelect.value = 'nvidia';
        }
      } else if (val === 'llama_cpp') {
        apiKeyHint.textContent = 'Optional for local models (defaults to http://localhost:8080/v1)';
        apiKeyInput.placeholder = 'Optional';
        if (!modelInput.value || modelInput.value.includes('gemini') || modelInput.value.includes('llama') || modelInput.value.includes('nemotron-3.5') || modelInput.value === 'llama3') {
          modelInput.value = 'nemotron-3-4b-int4';
        }
      } else if (val === 'ollama') {
        apiKeyHint.textContent = 'Optional for local models (defaults to http://localhost:11434)';
        apiKeyInput.placeholder = 'Optional';
        if (!modelInput.value || modelInput.value.includes('gemini') || modelInput.value.includes('nemotron')) {
          modelInput.value = 'llama3';
        }
      } else {
        apiKeyHint.textContent = 'Required for cloud model inference';
        apiKeyInput.placeholder = 'Enter your API key';
      }
    };
    providerSelect.addEventListener('change', updateProviderHints);
    updateProviderHints();

    // Event listeners
    overlay.querySelector('#closeSettingsBtn')?.addEventListener('click', () => this.close());
    overlay.querySelector('#cancelSettingsBtn')?.addEventListener('click', () => this.close());
    overlay.querySelector('#saveSettingsBtn')?.addEventListener('click', () => this.save());

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    this.onKeyDownListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.onKeyDownListener);
  }

  private onKeyDownListener?: (e: KeyboardEvent) => void;

  public isOpen(): boolean {
    return !!this.modalEl && document.body.contains(this.modalEl);
  }

  public async save(): Promise<void> {
    if (!this.modalEl) return;
    const providerSelect = this.modalEl.querySelector('#providerSelect') as HTMLSelectElement;
    const modelInput = this.modalEl.querySelector('#modelInput') as HTMLInputElement;
    const visionModelInput = this.modalEl.querySelector('#visionModelInput') as HTMLInputElement;
    const ttsSelect = this.modalEl.querySelector('#ttsSelect') as HTMLSelectElement;
    const apiKeyInput = this.modalEl.querySelector('#apiKeyInput') as HTMLInputElement;

    const newSettings: Settings = {
      llm_provider: (providerSelect.value as LLMProvider) || 'nvidia',
      model: modelInput.value.trim() && !modelInput.value.includes('llama-3.3-70b') ? modelInput.value.trim() : 'nvidia/nemotron-3.5-bolt-e4b',
      vision_model: visionModelInput ? visionModelInput.value.trim() || 'nvidia/nemotron-3.5-super-vl-120b-a12b' : undefined,
      tts_provider: ttsSelect ? (ttsSelect.value as 'nvidia' | 'system') : 'nvidia',
      tts_model: 'nvidia/magpie-tts-zeroshot',
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
    if (this.onKeyDownListener) {
      document.removeEventListener('keydown', this.onKeyDownListener);
      this.onKeyDownListener = undefined;
    }
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}
