// ==UserScript==
// @name         Echo - Live Speech to Text (Ghost Studio)
// @namespace    https://github.com/MiiuGR4U/Echo
// @version      2.4.1
// @description  Transcreve áudio com Ghost Dock, VAD adaptativo anti-cortes, Watchdog auto-recuperador, Dynamic Templates (Text Blaze para voz com {cursor}), quebras de linha e 100% configurável.
// @author       MiiuGR4U
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.groq.com
// @connect      api.openai.com
// @updateURL    https://raw.githubusercontent.com/MiiuGR4U/Echo/main/voice-transcribe.user.js
// @downloadURL  https://raw.githubusercontent.com/MiiuGR4U/Echo/main/voice-transcribe.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self && (window.innerWidth < 150 || window.innerHeight < 150)) return;

  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const isBrave = !!(navigator.brave && typeof navigator.brave.isBrave === 'function') ||
                  navigator.userAgent.includes('Brave');

  // =========================================================================
  // 1. CONFIGURAÇÕES PADRÃO 100% CUSTOMIZÁVEIS (NADA HARDCODED)
  // =========================================================================
  const DEFAULT_CONFIG = {
    // Motor & API
    engine: isBrave ? 'whisper' : 'native',
    groqApiKey: '',
    whisperModel: 'whisper-large-v3-turbo',
    lang: 'pt-BR',
    shortcut: 'Alt+V',

    // Modo de Envio & Comportamento
    outputMode: 'ghost', // 'ghost' (ver e editar antes de enviar) ou 'direct' (direto no campo)
    autoOpenGhostOnSpeech: true,
    aiPunctuation: false, // Desativado por padrão: não deixa Groq colocar pontuações indesejadas
    enablePunctuationCommands: true,
    autoCapitalize: true,
    addTrailingSpace: true,
    soundFx: true, // Beeps suaves ao ligar/desligar/inserir

    // VAD & Captura Contínua Inteligente (Zero Travamento & Zero Cortes Prematuros)
    vadSilencePauseMs: 1200, // Pausa de fala antes de cortar (ms) - permite respirar e falar com calma
    vadMaxSliceDurationMs: 12000, // Duração máxima contínua da frase (ms) - evita cortar no meio
    vadMinSpeechDurationMs: 350,
    vadVolumeThreshold: 10,
    autoRecoverAudio: true, // Watchdog auto-recuperador que destrava microfone se o navegador travar

    // Rótulos e Mensagens 100% Editáveis pelo dj (NADA HARDCODED)
    messages: {
      statusReady: 'Pronto',
      statusWhisperReady: 'Whisper Pronto',
      statusListening: 'Ouvindo...',
      statusTranscribing: 'Transcrevendo...',
      statusError: 'Erro',
      statusMicBlocked: 'Microfone bloqueado',
      statusNetworkError: 'Erro de rede',
      ghostTitle: 'Ghost Studio • Prévia e Edição',
      ghostPlaceholder: 'O que você disser aparecerá aqui... Edite o texto se quiser e envie para o campo ativo.',
      btnInsert: 'Inserir no Campo (Enter)',
      btnCopy: 'Copiar',
      btnClear: 'Limpar',
      btnModeGhost: 'Modo: Ghost',
      btnModeDirect: 'Modo: Direto',
      feedbackCopied: '✓ Copiado com sucesso!',
      feedbackInserted: '✓ Inserido no campo!',
      feedbackReset: '✓ Configurações restauradas para o padrão!',
      feedbackSaved: '✓ Configurações salvas com sucesso!',
      noTargetSelected: '⚠️ Clique em uma caixa de texto antes de inserir',
      noTargetCopiedFallback: '⚠️ Nenhum campo selecionado. Texto copiado para a área de transferência!',
      targetBadgePrefix: 'Alvo: ',
      targetNoneBadge: 'Nenhum campo selecionado',
      counterTemplate: '{words} palavras • {chars} caracteres',
      tooltipMic: 'Ligar/Desligar Microfone ({shortcut})',
      tooltipGhost: 'Abrir/Fechar Ghost Studio de Edição',
      tooltipSettings: 'Configurações & Mensagens',
      tooltipCloseGhost: 'Minimizar Ghost Studio',
      modalTitle: 'Configurações de Transcrição & Mensagens',
      btnSaveSettings: 'Salvar Todas as Configurações',
      btnCancelSettings: 'Cancelar',
      btnResetDefaults: 'Restaurar Padrões',

      // Abas e Novos Controles do Menu
      tabGeneral: '⚙️ Geral & Motor',
      tabDictionary: '📖 Dicionário & Pontuações',
      tabMessages: '💬 Mensagens & Textos',
      tabGeneralTitle: 'Motor de Reconhecimento, VAD & Atalhos',
      tabDictionaryTitle: 'Comandos de Voz, Pontuações & Templates',
      tabMessagesTitle: 'Personalização Completa de Mensagens',
      btnAddNewCommand: '+ Adicionar Comando',
      searchCommandsPlaceholder: 'Buscar comando, pontuação ou template...',
      searchMessagesPlaceholder: 'Buscar mensagem ou rótulo...',
      cmdActiveLabel: 'Ativo',
      cmdInactiveLabel: 'Inativo',
      quickChipsTitle: 'Pontuações Rápidas:',
      dynamicTemplatesTitle: '⚡ Dynamic Templates (Estilo Text Blaze por Voz):',
      commandsCountTemplate: '{count} comandos cadastrados ({active} ativos)',
      toastCommandAdded: '✓ Novo comando adicionado no topo!',
      toastTemplateInserted: '✓ Tag dinâmica adicionada ao template!'
    },

    // Comandos de voz falados (substituições dinâmicas com toggle individual e Text Blaze templates)
    commands: [
      // Exemplo prático Text Blaze com seletor de cursor {cursor}
      { spoken: 'palavra trabalhando', replace: 'Olá "{cursor}" estamos trabalhando nesse processo!', enabled: true },

      // Quebras de Linha e Parágrafos (Variações com e sem acento)
      { spoken: 'novo parágrafo', replace: '\n\n', enabled: true },
      { spoken: 'novo paragrafo', replace: '\n\n', enabled: true },
      { spoken: 'parágrafo', replace: '\n\n', enabled: true },
      { spoken: 'paragrafo', replace: '\n\n', enabled: true },
      { spoken: 'pular linha', replace: '\n', enabled: true },
      { spoken: 'pula linha', replace: '\n', enabled: true },
      { spoken: 'pule a linha', replace: '\n', enabled: true },
      { spoken: 'pular a linha', replace: '\n', enabled: true },
      { spoken: 'nova linha', replace: '\n', enabled: true },
      { spoken: 'quebra de linha', replace: '\n', enabled: true },
      { spoken: 'quebrar linha', replace: '\n', enabled: true },

      // Pontuações
      { spoken: 'vírgula', replace: ', ', enabled: true },
      { spoken: 'virgula', replace: ', ', enabled: true },
      { spoken: 'ponto final', replace: '. ', enabled: true },
      { spoken: 'ponto', replace: '. ', enabled: true },
      { spoken: 'ponto de interrogação', replace: '? ', enabled: true },
      { spoken: 'ponto de interrogacao', replace: '? ', enabled: true },
      { spoken: 'interrogação', replace: '? ', enabled: true },
      { spoken: 'interrogacao', replace: '? ', enabled: true },
      { spoken: 'ponto de exclamação', replace: '! ', enabled: true },
      { spoken: 'ponto de exclamacao', replace: '! ', enabled: true },
      { spoken: 'exclamação', replace: '! ', enabled: true },
      { spoken: 'exclamacao', replace: '! ', enabled: true },
      { spoken: 'dois pontos', replace: ': ', enabled: true },
      { spoken: 'ponto e vírgula', replace: '; ', enabled: true },
      { spoken: 'ponto e virgula', replace: '; ', enabled: true },
      { spoken: 'reticências', replace: '... ', enabled: true },
      { spoken: 'reticencias', replace: '... ', enabled: true },
      { spoken: 'abrir aspas', replace: '"', enabled: true },
      { spoken: 'fechar aspas', replace: '"', enabled: true },
      { spoken: 'traço', replace: ' - ', enabled: true },
      { spoken: 'traco', replace: ' - ', enabled: true },
      { spoken: 'abrir parênteses', replace: ' (', enabled: true },
      { spoken: 'abrir parenteses', replace: ' (', enabled: true },
      { spoken: 'fechar parênteses', replace: ') ', enabled: true },
      { spoken: 'fechar parenteses', replace: ') ', enabled: true },

      // Dynamic Templates (Estilo Text Blaze para Voz)
      { spoken: 'inserir data', replace: '{data}', enabled: true },
      { spoken: 'data de hoje', replace: '{data}', enabled: true },
      { spoken: 'inserir hora', replace: '{hora}', enabled: true },
      { spoken: 'saudação formal', replace: '{saudacao}! Tudo bem?', enabled: true },
      { spoken: 'saudacao formal', replace: '{saudacao}! Tudo bem?', enabled: true },
      { spoken: 'inserir assinatura', replace: 'Atenciosamente,\ndj\n{saudacao}! {data} às {hora}', enabled: true },
      { spoken: 'link da página', replace: '{url}', enabled: true },
      { spoken: 'link da pagina', replace: '{url}', enabled: true },
      { spoken: 'nome do site', replace: '{site}', enabled: true }
    ],

    hudPos: { bottom: 24, right: 24 }
  };

  function loadConfig() {
    try {
      let raw = null;
      if (typeof GM_getValue === 'function') {
        raw = GM_getValue('voice_stt_config', null);
      }
      if (!raw) {
        raw = localStorage.getItem('voice_stt_config');
      }
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const merged = Object.assign({}, DEFAULT_CONFIG, parsed);
        merged.messages = Object.assign({}, DEFAULT_CONFIG.messages, parsed.messages || {});
        if (!merged.hudPos) merged.hudPos = { bottom: 24, right: 24 };
        if (!Array.isArray(merged.commands)) {
          merged.commands = JSON.parse(JSON.stringify(DEFAULT_CONFIG.commands));
        } else {
          const existingSpoken = new Set(merged.commands.map((c) => (c.spoken || '').trim().toLowerCase()));
          DEFAULT_CONFIG.commands.forEach((defCmd) => {
            if (!existingSpoken.has((defCmd.spoken || '').trim().toLowerCase())) {
              merged.commands.push(Object.assign({}, defCmd));
            }
          });
        }
        return merged;
      }
    } catch (e) {
      console.warn('[VoiceSTT] Falha ao carregar config:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function saveConfig(cfg) {
    try {
      const serialized = JSON.stringify(cfg);
      if (typeof GM_setValue === 'function') {
        GM_setValue('voice_stt_config', serialized);
      }
      localStorage.setItem('voice_stt_config', serialized);
    } catch (e) {
      console.warn('[VoiceSTT] Falha ao salvar config:', e);
    }
  }

  // =========================================================================
  // 2. ESTADO GLOBAL DA APLICAÇÃO
  // =========================================================================
  const state = {
    config: loadConfig(),
    isListening: false,
    manualStop: true,
    targetElement: null,
    audioStream: null,
    audioCtx: null,
    analyser: null,
    vadInterval: null,
    mediaRecorder: null,
    audioChunks: [],
    hasSpeechInSlice: false,
    lastSpeechTime: 0,
    sliceStartTime: 0,
    ghostText: '',
    lastCommittedChunk: '',
    lastRawChunk: '',
    lastRawChunkTime: 0,
    recentRawHistory: [],
    isGhostOpen: false,
    recognition: null,
    feedbackTimeout: null,
    whisperQueue: [],
    isWhisperProcessing: false,
    activeModalTab: 'general',
    watchdogInterval: null,
    lastFocusedCmdInput: null
  };

  // Helper dinâmico para obter qualquer mensagem configurada
  function msg(key, params = {}) {
    let str = (state.config.messages && state.config.messages[key]) || DEFAULT_CONFIG.messages[key] || '';
    Object.keys(params).forEach((p) => {
      str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
    return str;
  }

  // Efeitos sonoros sutis com Web Audio API nativo (sem arquivos externos)
  function playBeep(freq = 600, durationMs = 45, type = 'sine') {
    if (!state.config.soundFx) return;
    try {
      const AudioCtxClass = win.AudioContext || win.webkitAudioContext || window.AudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (durationMs / 1000));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (durationMs / 1000));
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, durationMs + 80);
    } catch (e) {}
  }

  // =========================================================================
  // 3. DETECÇÃO & GERENCIAMENTO DO ELEMENTO ALVO NA PÁGINA
  // =========================================================================
  function isTextInputElement(el) {
    if (!el || el.nodeType !== 1) return false;
    // Ignora elementos internos do próprio Shadow DOM do script
    if (el.classList && (el.classList.contains('ghost-editor-input') || el.classList.contains('stt-input-text') || el.classList.contains('stt-msg-val') || el.classList.contains('stt-cmd-spoken') || el.classList.contains('stt-cmd-replace'))) {
      return false;
    }

    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email', 'tel', 'password', ''].includes(type);
    }
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') {
      return true;
    }
    return false;
  }

  function getElementDescriptor(el) {
    if (!el) return msg('targetNoneBadge');
    const tag = (el.tagName || 'campo').toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const name = el.name ? `[name="${el.name}"]` : '';
    const placeholder = el.placeholder ? ` "${el.placeholder.slice(0, 15)}..."` : '';
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      return `[editável] ${id || el.className || 'rich-text'}`;
    }
    return `<${tag}${id}${name}>${placeholder}`.trim();
  }

  function updateTargetIndicator() {
    if (!hudElements.ghostTargetBadge) return;
    const target = resolveActiveTarget();
    if (target) {
      hudElements.ghostTargetBadge.textContent = `${msg('targetBadgePrefix')}${getElementDescriptor(target)}`;
      hudElements.ghostTargetBadge.classList.add('has-target');
      hudElements.ghostTargetBadge.classList.remove('no-target');
    } else {
      hudElements.ghostTargetBadge.textContent = msg('targetNoneBadge');
      hudElements.ghostTargetBadge.classList.remove('has-target');
      hudElements.ghostTargetBadge.classList.add('no-target');
    }
  }

  document.addEventListener('focusin', (e) => {
    let el = e.target;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    if (isTextInputElement(el)) {
      state.targetElement = el;
      updateTargetIndicator();
    }
  }, true);

  document.addEventListener('click', (e) => {
    let el = e.target;
    if (isTextInputElement(el)) {
      state.targetElement = el;
      updateTargetIndicator();
    }
  }, true);

  function resolveActiveTarget() {
    if (state.targetElement && document.contains(state.targetElement)) {
      return state.targetElement;
    }
    let active = document.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    if (isTextInputElement(active)) {
      state.targetElement = active;
      return active;
    }
    const candidate = document.querySelector('textarea:focus, input[type="text"]:focus, [contenteditable="true"]:focus, [role="textbox"]:focus');
    if (candidate && isTextInputElement(candidate)) {
      state.targetElement = candidate;
      return candidate;
    }
    return null;
  }

  // =========================================================================
  // 4. DESDUPLICAÇÃO MATEMÁTICA & PROCESSAMENTO DE TEXTO (ZERO REPETIÇÃO)
  // =========================================================================
  // Elimina duplicatas parciais ou totais de palavras fatiadas pelo VAD ou reconhecedor
  function deduplicateOverlap(existingText, newChunk) {
    if (!existingText || !newChunk) return newChunk;

    const normalize = (t) => t.trim().replace(/[.,!?:;"]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
    const cleanExisting = normalize(existingText);
    const cleanNew = normalize(newChunk);
    const rawNewWords = newChunk.trim().split(/\s+/).filter(Boolean);

    if (cleanExisting.length === 0 || cleanNew.length === 0) return newChunk;

    // 1. Se a nova frase inteira já é exatamente o final do texto existente (repetição total)
    const existingTail = cleanExisting.slice(-cleanNew.length).join(' ');
    const newFull = cleanNew.join(' ');
    if (existingTail === newFull) {
      return ''; // Completamente duplicado, descarta
    }

    // 2. Se a frase nova já está contida ou finaliza os últimos 35 vocábulos do texto existente
    const recentWindow = cleanExisting.slice(-Math.min(35, cleanExisting.length)).join(' ');
    if (recentWindow.endsWith(newFull) || recentWindow.includes(newFull)) {
      return '';
    }

    // 3. Procura sobreposição parcial de 1 até 25 palavras
    const maxOverlap = Math.min(25, cleanExisting.length, cleanNew.length);
    for (let overlap = maxOverlap; overlap >= 1; overlap--) {
      const tail = cleanExisting.slice(-overlap).join(' ');
      const head = cleanNew.slice(0, overlap).join(' ');
      if (tail === head) {
        return rawNewWords.slice(overlap).join(' ');
      }
    }

    return newChunk;
  }

  function makeAccentInsensitiveRegex(str) {
    const accentMap = {
      'a': '[aáàãâäAÁÀÃÂÄ]',
      'e': '[eéèêëEÉÈÊË]',
      'i': '[iíìîïIÍÌÎÏ]',
      'o': '[oóòõôöOÓÒÕÔÖ]',
      'u': '[uúùûüUÚÙÛÜ]',
      'c': '[cçCÇ]'
    };
    let result = '';
    const clean = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i].toLowerCase();
      if (accentMap[char]) {
        result += accentMap[char];
      } else {
        result += clean[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }
    return result;
  }

  // =========================================================================
  // 4.1 MOTOR DE TEMPLATES DINÂMICOS (ESTILO TEXT BLAZE PARA ÁUDIO)
  // =========================================================================
  function evaluateDynamicTemplate(templateStr) {
    if (!templateStr || typeof templateStr !== 'string') return templateStr;
    let text = templateStr;

    // Converte sequências de escape literais \n e \t digitadas nos campos para quebras de linha reais
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    // {saudacao} - Saudação contextual inteligente pelo horário
    const currentHour = now.getHours();
    const saudacao = currentHour >= 5 && currentHour < 12 ? 'Bom dia' :
                     currentHour >= 12 && currentHour < 18 ? 'Boa tarde' : 'Boa noite';
    text = text.replace(/\{saudacao\}/gi, saudacao);

    // {data} / {date} com suporte a deslocamento relativo (+1d, +7d, -1d)
    text = text.replace(/\{(?:data|date)(?::([+-]?\d+)([dmy]))?\}/gi, (match, offsetVal, offsetUnit) => {
      const d = new Date(now.getTime());
      if (offsetVal && offsetUnit) {
        const val = parseInt(offsetVal, 10);
        const unit = offsetUnit.toLowerCase();
        if (unit === 'd') d.setDate(d.getDate() + val);
        else if (unit === 'm') d.setMonth(d.getMonth() + val);
        else if (unit === 'y') d.setFullYear(d.getFullYear() + val);
      }
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    });

    // {data:iso} -> AAAA-MM-DD
    text = text.replace(/\{(?:data|date):iso\}/gi, () => {
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    });

    // {hora} / {time} -> HH:MM
    text = text.replace(/\{(?:hora|time)\}/gi, () => `${pad(now.getHours())}:${pad(now.getMinutes())}`);

    // {hora:seg} / {hora:segundos} -> HH:MM:SS
    text = text.replace(/\{(?:hora|time):(?:seg|segundos)\}/gi, () => `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);

    // {dia_semana}
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    text = text.replace(/\{dia_semana\}/gi, diasSemana[now.getDay()]);

    // {mes}
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    text = text.replace(/\{mes\}/gi, meses[now.getMonth()]);

    // {ano}
    text = text.replace(/\{ano\}/gi, String(now.getFullYear()));

    // Contexto da Página Atual: {site}, {domain}, {url}, {titulo}, {title}
    const domain = window.location.hostname.replace(/^www\./, '') || 'localhost';
    text = text.replace(/\{(?:site|domain)\}/gi, domain);
    text = text.replace(/\{url\}/gi, window.location.href);
    text = text.replace(/\{(?:titulo|title)\}/gi, document.title || domain);

    // Fórmulas Matemáticas Dinâmicas: {calc: 10 * 5 + 3}
    text = text.replace(/\{calc:\s*([^}]+)\}/gi, (match, expr) => {
      try {
        const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
        if (!sanitized.trim()) return match;
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${sanitized});`)();
        if (typeof result === 'number' && !isNaN(result)) {
          return Number.isInteger(result) ? String(result) : result.toFixed(2);
        }
        return String(result);
      } catch (e) {
        return match;
      }
    });

    // Seleção Randômica: {random: Opção A | Opção B | Opção C}
    text = text.replace(/\{random:\s*([^}]+)\}/gi, (match, optionsStr) => {
      const opts = optionsStr.split('|').map((o) => o.trim()).filter(Boolean);
      if (opts.length === 0) return match;
      return opts[Math.floor(Math.random() * opts.length)];
    });

    return text;
  }

  function applyVoiceCommands(rawText) {
    if (!state.config.enablePunctuationCommands || !state.config.commands) {
      return evaluateDynamicTemplate(rawText);
    }
    let processed = rawText;
    const activeCommands = state.config.commands
      .filter((c) => c.enabled && c.spoken && c.spoken.trim())
      .sort((a, b) => b.spoken.length - a.spoken.length);

    activeCommands.forEach((cmd) => {
      const pattern = makeAccentInsensitiveRegex(cmd.spoken.trim());
      // Verifica se o comando substitui por quebra de linha (\n ou \n\n)
      const isNewlineCmd = (cmd.replace || '').includes('\n') || cmd.replace === '\\n' || cmd.replace === '\\n\\n';
      const regex = new RegExp(`(^|\\s)${pattern}(?=\\s|$|[.,!?:;])`, 'gi');

      processed = processed.replace(regex, (match, prefix) => {
        const expanded = evaluateDynamicTemplate(cmd.replace);
        // Em quebras de linha, descarta o espaço precedente para grudar a quebra na palavra anterior
        if (isNewlineCmd) {
          return expanded;
        }
        return prefix + expanded;
      });
    });

    // Também processa quaisquer tags dinâmicas que tenham sido ditas diretamente
    processed = evaluateDynamicTemplate(processed);

    // Remove espaços antes de sinais de pontuação
    processed = processed.replace(/\s+([.,!?:;])/g, '$1');

    // Remove espaços supérfluos grudados em quebras de linha
    processed = processed.replace(/[ \t]*\n[ \t]*/g, '\n');

    return processed;
  }

  function formatPhrase(rawText, isFirstChunk) {
    let text = rawText.trim();
    if (!text) return '';

    // Se pontuação da IA estiver desligada, remove pontos/vírgulas automáticos do Whisper
    if (!state.config.aiPunctuation) {
      text = text.replace(/[.,!?:;"]/g, '');
      text = text.replace(/\s+/g, ' ').trim();
    }

    text = applyVoiceCommands(text);

    if (state.config.autoCapitalize && isFirstChunk) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    if (state.config.addTrailingSpace && !text.endsWith('\n') && !text.endsWith(' ')) {
      text += ' ';
    }
    return text;
  }

  // =========================================================================
  // 5. GHOST STUDIO: BUFFER DE PRÉVIA, EDIÇÃO & ENVIO INTERATIVO
  // =========================================================================
  function handleTranscribedChunk(rawChunk) {
    if (state.manualStop || !state.isListening) return;
    if (!rawChunk || !rawChunk.trim()) return;

    // 1. Supressão instantânea de fatia idêntica repetida em curto intervalo (< 3500ms)
    const normalizedRaw = rawChunk.trim().toLowerCase().replace(/[.,!?:;"]/g, '').replace(/\s+/g, ' ');
    const now = Date.now();
    if (state.lastRawChunk === normalizedRaw && (now - (state.lastRawChunkTime || 0)) < 3500) {
      console.log('[Echo] Supressão instantânea de fatia repetida em <3.5s:', normalizedRaw);
      return;
    }
    state.lastRawChunk = normalizedRaw;
    state.lastRawChunkTime = now;

    // 2. Supressão contra histórico de vocábulos recentes para evitar eco do Whisper
    if (!state.recentRawHistory) state.recentRawHistory = [];
    state.recentRawHistory = state.recentRawHistory.filter((item) => (now - item.time) < 6000);
    const recentWordsStr = state.recentRawHistory.map((item) => item.word).join(' ');
    const newWords = normalizedRaw.split(/\s+/).filter(Boolean);
    if (newWords.length > 0 && recentWordsStr.includes(normalizedRaw)) {
      console.log('[Echo] Supressão por histórico recente de fatias:', normalizedRaw);
      return;
    }
    newWords.forEach((w) => state.recentRawHistory.push({ word: w, time: now }));

    // 3. Remove repetição verificando contra o texto acumulado no Ghost Studio
    const baseText = state.ghostText || state.lastCommittedChunk || '';
    const deduplicated = deduplicateOverlap(baseText, rawChunk);
    if (!deduplicated || !deduplicated.trim()) return;

    state.lastCommittedChunk = deduplicated;
    const isFirst = !state.ghostText || state.ghostText.trim().length === 0;
    const formatted = formatPhrase(deduplicated, isFirst);

    if (state.config.outputMode === 'direct') {
      // Modo Direto: injeta diretamente no campo focado da página
      const target = resolveActiveTarget();
      if (target) {
        injectIntoPageElement(target, formatted);
      }
    } else {
      // Modo Ghost: joga no buffer para o usuário visualizar, editar e confirmar
      appendGhostText(formatted);
    }
  }

  function appendGhostText(text) {
    const cursorMarker = '{cursor}';
    const hasCursor = text.includes(cursorMarker);
    const cursorOffset = hasCursor ? text.indexOf(cursorMarker) : -1;
    const cleanText = hasCursor ? text.split(cursorMarker).join('') : text;

    const prevLength = (state.ghostText || '').length;
    state.ghostText = (state.ghostText || '') + cleanText;

    if (hudElements.ghostInput) {
      hudElements.ghostInput.value = state.ghostText;
      if (hasCursor) {
        hudElements.ghostInput.focus();
        const caretPos = prevLength + cursorOffset;
        hudElements.ghostInput.selectionStart = hudElements.ghostInput.selectionEnd = caretPos;
      } else {
        hudElements.ghostInput.scrollTop = hudElements.ghostInput.scrollHeight;
      }
    }
    updateGhostCounters();

    // Abre o Ghost Studio automaticamente ao começar a falar se configurado
    if (state.config.autoOpenGhostOnSpeech && !state.isGhostOpen) {
      openGhostDock();
    }
  }

  function updateGhostCounters() {
    if (!hudElements.ghostCounter) return;
    const chars = (state.ghostText || '').length;
    const words = (state.ghostText || '').trim() ? state.ghostText.trim().split(/\s+/).length : 0;
    hudElements.ghostCounter.textContent = msg('counterTemplate', { words, chars });
  }

  function injectGhostToTarget() {
    const textToInsert = hudElements.ghostInput ? hudElements.ghostInput.value : state.ghostText;
    if (!textToInsert || !textToInsert.trim()) return;

    const target = resolveActiveTarget();
    if (!target) {
      // Se não há campo selecionado na página, copia para a área de transferência como fallback
      navigator.clipboard.writeText(textToInsert.replace(/\{cursor\}/g, '')).then(() => {
        flashFeedback(msg('noTargetCopiedFallback'), false);
        playBeep(880, 80, 'triangle');
      }).catch(() => {
        flashFeedback(msg('noTargetSelected'), true);
      });
      return;
    }

    const ghostCaretPos = hudElements.ghostInput ? hudElements.ghostInput.selectionStart : null;
    injectIntoPageElement(target, textToInsert, ghostCaretPos);
    flashFeedback(msg('feedbackInserted'), false);
    playBeep(660, 60, 'sine');

    // Limpa o Ghost e fecha o dock após envio
    clearGhost();
    closeGhostDock();
  }

  function copyGhostToClipboard() {
    const text = hudElements.ghostInput ? hudElements.ghostInput.value : state.ghostText;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      flashFeedback(msg('feedbackCopied'), false);
      playBeep(750, 45, 'sine');
    }).catch(() => {
      if (hudElements.ghostInput) {
        hudElements.ghostInput.select();
        document.execCommand('copy');
        flashFeedback(msg('feedbackCopied'), false);
      }
    });
  }

  function clearGhost() {
    state.ghostText = '';
    state.lastCommittedChunk = '';
    if (hudElements.ghostInput) {
      hudElements.ghostInput.value = '';
    }
    updateGhostCounters();
  }

  function toggleOutputMode() {
    state.config.outputMode = state.config.outputMode === 'ghost' ? 'direct' : 'ghost';
    saveConfig(state.config);
    updateModeButtonLabel();
    flashFeedback(`Modo alterado: ${state.config.outputMode === 'ghost' ? 'Ghost Studio' : 'Direto'}`, false);
  }

  function updateModeButtonLabel() {
    if (!hudElements.btnModeGhost) return;
    const isGhost = state.config.outputMode === 'ghost';
    hudElements.btnModeGhost.textContent = isGhost ? msg('btnModeGhost') : msg('btnModeDirect');
    hudElements.btnModeGhost.style.color = isGhost ? '#38bdf8' : '#10b981';
  }

  function flashFeedback(text, isError) {
    if (!hudElements.ghostFeedback) return;
    hudElements.ghostFeedback.textContent = text;
    hudElements.ghostFeedback.style.color = isError ? '#f87171' : '#34d399';
    hudElements.ghostFeedback.style.opacity = '1';
    clearTimeout(state.feedbackTimeout);
    state.feedbackTimeout = setTimeout(() => {
      if (hudElements.ghostFeedback) {
        hudElements.ghostFeedback.style.opacity = '0';
      }
    }, 2800);
  }

  function injectIntoPageElement(target, text, explicitCaretOffset = null) {
    if (document.activeElement !== target) {
      try { target.focus(); } catch (e) {}
    }

    const cursorMarker = '{cursor}';
    let cleanText = text;
    let targetCaretOffset = explicitCaretOffset;

    if (text.includes(cursorMarker)) {
      targetCaretOffset = text.indexOf(cursorMarker);
      cleanText = text.split(cursorMarker).join('');
    }

    const isContentEditable = target.isContentEditable ||
      target.getAttribute('contenteditable') === 'true' ||
      target.getAttribute('role') === 'textbox';

    if (isContentEditable) {
      target.focus();
      const sel = win.getSelection ? win.getSelection() : window.getSelection();
      if (!sel || !sel.rangeCount || !target.contains(sel.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      const range = sel.getRangeAt(0);
      range.deleteContents();

      if (cleanText.includes('\n')) {
        const frag = document.createDocumentFragment();
        const lines = cleanText.split('\n');
        let caretTargetNode = null;
        let caretTargetOffsetInNode = 0;
        let charCounter = 0;

        lines.forEach((line, index) => {
          if (index > 0) {
            frag.appendChild(document.createElement('br'));
            charCounter += 1;
          }
          if (line) {
            const tNode = document.createTextNode(line);
            frag.appendChild(tNode);
            if (targetCaretOffset !== null && !caretTargetNode) {
              if (targetCaretOffset <= charCounter + line.length) {
                caretTargetNode = tNode;
                caretTargetOffsetInNode = Math.max(0, targetCaretOffset - charCounter);
              }
            }
            charCounter += line.length;
          }
        });

        if (!caretTargetNode) {
          const lastChild = frag.lastChild;
          if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
            caretTargetNode = lastChild;
            caretTargetOffsetInNode = lastChild.length;
          }
        }

        range.insertNode(frag);

        if (caretTargetNode) {
          const newRange = document.createRange();
          try {
            newRange.setStart(caretTargetNode, caretTargetOffsetInNode);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          } catch (e) {}
        }
      } else {
        const textNode = document.createTextNode(cleanText);
        range.insertNode(textNode);

        // Posiciona o seletor de texto exatamente onde o cursor deve ficar
        const caretIndex = (typeof targetCaretOffset === 'number' && targetCaretOffset >= 0)
          ? Math.min(targetCaretOffset, cleanText.length)
          : cleanText.length;

        const newRange = document.createRange();
        try {
          newRange.setStart(textNode, caretIndex);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } catch (err) {}
      }

      target.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: cleanText }));
    } else {
      const val = target.value || '';
      const pos = target.selectionStart !== null ? target.selectionStart : val.length;
      const before = val.slice(0, pos);
      const after = val.slice(pos);
      const newVal = before + cleanText + after;

      const proto = target.tagName.toLowerCase() === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

      if (nativeSetter) {
        nativeSetter.call(target, newVal);
      } else {
        target.value = newVal;
      }

      const caretIndex = (typeof targetCaretOffset === 'number' && targetCaretOffset >= 0)
        ? (pos + Math.min(targetCaretOffset, cleanText.length))
        : (pos + cleanText.length);

      target.selectionStart = target.selectionEnd = caretIndex;

      target.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: cleanText }));
      target.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  }

  // =========================================================================
  // 6. MOTOR DE CAPTURA & ÁUDIO CONTÍNUO (VAD COM SEQUENCIAMENTO SEGURO)
  // =========================================================================
  async function ensureMicrophoneStream() {
    if (state.audioStream && state.audioStream.active) return state.audioStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.audioStream = stream;
      return stream;
    } catch (err) {
      console.warn('[VoiceSTT] Permissão de microfone negada:', err);
      updateHudState('error', msg('statusMicBlocked'));
      return null;
    }
  }

  // Watchdog Auto-Recuperador que monitora AudioContext e MediaRecorder a cada 2.5s
  function startAudioWatchdog() {
    stopAudioWatchdog();
    if (state.config.autoRecoverAudio === false) return;

    state.watchdogInterval = setInterval(async () => {
      if (!state.isListening || state.manualStop) return;

      // 1. Reativa AudioContext suspenso pelo navegador
      if (state.audioCtx && state.audioCtx.state === 'suspended') {
        try {
          console.log('[VoiceSTT Watchdog] Recuperando AudioContext suspenso...');
          await state.audioCtx.resume();
        } catch (e) {}
      }

      // 2. Re-adquire microfone se a stream tiver sido cancelada
      if (!state.audioStream || !state.audioStream.active) {
        console.log('[VoiceSTT Watchdog] Stream de áudio inativa. Re-adquirindo...');
        const stream = await ensureMicrophoneStream();
        if (stream && state.isListening && !state.manualStop) {
          startContinuousSlice(stream);
        }
        return;
      }

      // 3. Verifica se MediaRecorder parou inesperadamente
      if (state.config.engine === 'whisper') {
        if (state.mediaRecorder && state.mediaRecorder.state === 'inactive' && !state.isWhisperProcessing) {
          console.log('[VoiceSTT Watchdog] MediaRecorder inativo detectado durante escuta. Reiniciando fatia...');
          startContinuousSlice(state.audioStream);
        }

        // 4. Se uma fatia estiver gravando há mais tempo que o teto de segurança, força o stop para enviar o áudio
        const elapsed = Date.now() - state.sliceStartTime;
        const maxSafetyDuration = (state.config.vadMaxSliceDurationMs || 12000) + 3000;
        if (state.mediaRecorder && state.mediaRecorder.state === 'recording' && elapsed > maxSafetyDuration) {
          console.log(`[VoiceSTT Watchdog] Fatia estagnada há ${elapsed}ms. Forçando flush...`);
          try {
            state.mediaRecorder.stop();
          } catch (e) {}
        }
      }
    }, 2500);
  }

  function stopAudioWatchdog() {
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
      state.watchdogInterval = null;
    }
  }

  async function startWhisperContinuous() {
    const stream = await ensureMicrophoneStream();
    if (!stream) return;

    try {
      const AudioCtxClass = win.AudioContext || win.webkitAudioContext || window.AudioContext;
      if (!state.audioCtx || state.audioCtx.state === 'closed') {
        state.audioCtx = new AudioCtxClass();
      }
      if (state.audioCtx.state === 'suspended') {
        await state.audioCtx.resume();
      }

      if (!state.analyser) {
        const source = state.audioCtx.createMediaStreamSource(stream);
        state.analyser = state.audioCtx.createAnalyser();
        state.analyser.fftSize = 256;
        source.connect(state.analyser);
      }
    } catch (e) {
      console.warn('[VoiceSTT] Audio analyser error:', e);
    }

    state.isListening = true;
    state.manualStop = false;
    playBeep(880, 50, 'sine');
    updateHudState('listening', msg('statusListening'));
    updateTargetIndicator();

    startContinuousSlice(stream);
    startVadLoop();
    startAudioWatchdog();
  }

  function startContinuousSlice(stream) {
    if (!state.isListening || state.manualStop) return;

    state.audioChunks = [];
    state.hasSpeechInSlice = false;
    state.sliceStartTime = Date.now();
    state.lastSpeechTime = Date.now();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');

    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      state.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          state.audioChunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (state.manualStop || !state.isListening) {
          state.audioChunks = [];
          state.hasSpeechInSlice = false;
          return;
        }

        const chunks = state.audioChunks;
        const hadSpeech = state.hasSpeechInSlice;
        const sliceDuration = Date.now() - state.sliceStartTime;
        state.audioChunks = [];

        // Só envia se houve fala real e duração mínima suficiente (evita ruídos estáticos vazios)
        if (chunks.length > 0 && hadSpeech && sliceDuration >= (state.config.vadMinSpeechDurationMs || 350)) {
          const blob = new Blob(chunks, { type: mimeType });
          queueWhisperAudio(blob);
        }

        if (state.isListening && !state.manualStop) {
          startContinuousSlice(stream);
        }
      };

      recorder.onerror = (err) => {
        console.warn('[VoiceSTT] MediaRecorder error:', err);
        if (state.isListening && !state.manualStop) {
          setTimeout(() => {
            if (state.isListening && !state.manualStop) {
              startContinuousSlice(stream);
            }
          }, 300);
        }
      };

      recorder.start();
    } catch (err) {
      console.warn('[VoiceSTT] Falha ao iniciar MediaRecorder:', err);
      // Auto-recuperação com retry
      if (state.isListening && !state.manualStop) {
        setTimeout(() => {
          if (state.isListening && !state.manualStop) {
            startContinuousSlice(stream);
          }
        }, 500);
      }
    }
  }

  function startVadLoop() {
    clearInterval(state.vadInterval);
    const silenceLimit = state.config.vadSilencePauseMs || 1200;
    const maxSliceLimit = state.config.vadMaxSliceDurationMs || 12000;
    const volumeThresh = state.config.vadVolumeThreshold || 10;

    state.vadInterval = setInterval(() => {
      if (!state.isListening || state.manualStop || !state.analyser) return;

      const data = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const volume = sum / data.length;

      // Equalizador dinâmico de 4 barras com alturas animadas
      updateAudioVisualizer(data, volume);

      if (volume > volumeThresh) {
        state.hasSpeechInSlice = true;
        state.lastSpeechTime = Date.now();
      }

      const elapsed = Date.now() - state.sliceStartTime;
      const silenceDuration = Date.now() - state.lastSpeechTime;

      // Corta a fatia quando o usuário pausar por >= vadSilencePauseMs (ex: 1200ms) ou atingir vadMaxSliceDurationMs (ex: 12s)
      if (state.hasSpeechInSlice) {
        if ((silenceDuration >= silenceLimit && elapsed > 1000) || elapsed >= maxSliceLimit) {
          if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
            state.mediaRecorder.stop();
          }
        }
      } else if (elapsed > Math.max(6000, maxSliceLimit)) {
        // Reseta fatia vazia longa sem fala
        if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
          state.mediaRecorder.stop();
        }
      }
    }, 45);
  }

  function updateAudioVisualizer(freqData, volume) {
    if (!hudElements.waveBars) return;
    const bars = hudElements.waveBars;
    if (volume < 8) {
      bars.forEach((b) => (b.style.height = '4px'));
      return;
    }
    const h1 = Math.min(18, 4 + (freqData[2] || 0) / 14);
    const h2 = Math.min(22, 4 + (freqData[6] || 0) / 10);
    const h3 = Math.min(20, 4 + (freqData[12] || 0) / 12);
    const h4 = Math.min(16, 4 + (freqData[20] || 0) / 16);

    if (bars[0]) bars[0].style.height = `${h1}px`;
    if (bars[1]) bars[1].style.height = `${h2}px`;
    if (bars[2]) bars[2].style.height = `${h3}px`;
    if (bars[3]) bars[3].style.height = `${h4}px`;
  }

  function stopWhisperContinuous() {
    state.manualStop = true;
    state.isListening = false;
    clearInterval(state.vadInterval);
    state.vadInterval = null;
    stopAudioWatchdog();

    // 1. Descarta filas e buffers pendentes para que nada seja transcrito após desligar
    state.whisperQueue = [];
    state.audioChunks = [];
    state.hasSpeechInSlice = false;

    // 2. Para e fecha o MediaRecorder imediatamente
    if (state.mediaRecorder) {
      try {
        if (state.mediaRecorder.state !== 'inactive') {
          state.mediaRecorder.stop();
        }
      } catch (e) {}
      state.mediaRecorder = null;
    }

    // 3. Libera e desliga fisicamente o microfone (apaga luz/indicador vermelho do navegador e OS)
    if (state.audioStream) {
      try {
        state.audioStream.getTracks().forEach((track) => {
          try { track.stop(); } catch (err) {}
        });
      } catch (e) {}
      state.audioStream = null;
    }

    // 4. Desconecta o analisador e suspende o AudioContext
    if (state.analyser) {
      try { state.analyser.disconnect(); } catch (e) {}
      state.analyser = null;
    }
    if (state.audioCtx && state.audioCtx.state !== 'closed') {
      try { state.audioCtx.suspend(); } catch (e) {}
    }

    if (hudElements.waveBars) {
      hudElements.waveBars.forEach((b) => (b.style.height = '4px'));
    }

    playBeep(440, 50, 'sine');
    updateHudState('idle', msg('statusReady'));
  }

  // Fila sequencial estrita para evitar respostas de áudio fora de ordem
  function queueWhisperAudio(blob) {
    if (state.manualStop || !state.isListening) return;
    state.whisperQueue.push(blob);
    processNextWhisperAudio();
  }

  async function processNextWhisperAudio() {
    if (state.manualStop || !state.isListening) {
      state.whisperQueue = [];
      state.isWhisperProcessing = false;
      return;
    }
    if (state.isWhisperProcessing || state.whisperQueue.length === 0) return;
    state.isWhisperProcessing = true;
    const blob = state.whisperQueue.shift();
    try {
      await sendToWhisperApi(blob);
    } catch (e) {
      console.warn('[VoiceSTT] Whisper error:', e);
    } finally {
      state.isWhisperProcessing = false;
      if (state.isListening && !state.manualStop && state.whisperQueue.length > 0) {
        processNextWhisperAudio();
      }
    }
  }

  async function sendToWhisperApi(blob) {
    if (state.manualStop || !state.isListening) return;

    const apiKey = (state.config.groqApiKey || '').trim();
    if (!apiKey) {
      updateHudState('error', 'Sem Chave Groq');
      return;
    }

    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', state.config.whisperModel || 'whisper-large-v3-turbo');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0');

    // Nota de Engenharia: Não passar prompt estático como 'transcricao direta sem pontuacao'
    // pois o Groq Whisper usa o prompt como contexto prévio e gera eco/repetição involuntária de palavras.

    if (hudElements.statusText && state.isListening) {
      hudElements.statusText.textContent = msg('statusTranscribing');
    }

    return new Promise((resolve) => {
      const handleResponse = (text) => {
        // Se desativou enquanto a requisição HTTP estava voando, DESCARTA IMEDIATAMENTE
        if (state.manualStop || !state.isListening) {
          resolve();
          return;
        }

        try {
          const data = JSON.parse(text);
          if (data && data.text) {
            handleTranscribedChunk(data.text);
          }
        } catch (err) {
          console.error('[VoiceSTT] JSON parse error:', err);
        }
        if (hudElements.statusText && state.isListening) {
          hudElements.statusText.textContent = msg('statusListening');
        }
        resolve();
      };

      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://api.groq.com/openai/v1/audio/transcriptions',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          data: formData,
          onload: (res) => handleResponse(res.responseText),
          onerror: (err) => {
            console.error('[VoiceSTT] Erro API:', err);
            updateHudState('error', 'Erro API');
            resolve();
          }
        });
      } else {
        fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData
        })
          .then((r) => r.text())
          .then(handleResponse)
          .catch(() => resolve());
      }
    });
  }

  // --- MOTOR NATIVO (GOOGLE SPEECH - CHROME/EDGE COM SUPRESSÃO DE DUPLICATAS) ---
  const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition || window.SpeechRecognition || window.webkitSpeechRecognition;

  function initNativeEngine() {
    if (!SpeechRecognition) return null;
    const recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = state.config.lang || 'pt-BR';
    recognizer.maxAlternatives = 1;

    let lastProcessedResultIndex = -1;

    recognizer.onstart = () => {
      state.isListening = true;
      state.manualStop = false;
      lastProcessedResultIndex = -1;
      playBeep(880, 50, 'sine');
      updateHudState('listening', msg('statusListening'));
      updateTargetIndicator();
    };

    recognizer.onresult = (event) => {
      if (state.manualStop || !state.isListening) return;
      let finalChunk = '';
      for (let i = Math.max(event.resultIndex, lastProcessedResultIndex + 1); i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript;
          lastProcessedResultIndex = i;
        }
      }
      if (finalChunk.trim()) {
        handleTranscribedChunk(finalChunk);
      }
    };

    recognizer.onerror = (event) => {
      if (event.error === 'network') {
        state.isListening = false;
        state.manualStop = true;
        updateHudState('error', msg('statusNetworkError'));
      } else if (event.error === 'not-allowed') {
        state.isListening = false;
        state.manualStop = true;
        updateHudState('error', msg('statusMicBlocked'));
      }
    };

    recognizer.onend = () => {
      if (!state.manualStop && state.isListening) {
        setTimeout(() => {
          try { recognizer.start(); } catch (e) {}
        }, 200);
      } else {
        state.isListening = false;
        playBeep(440, 50, 'sine');
        updateHudState('idle', msg('statusReady'));
      }
    };

    return recognizer;
  }

  async function startListening() {
    resolveActiveTarget();
    const activeEngine = state.config.engine || (isBrave ? 'whisper' : 'native');

    if (activeEngine === 'whisper') {
      startWhisperContinuous();
    } else {
      if (!SpeechRecognition) {
        alert('Seu navegador não possui suporte ao Google Speech nativo. Alterne para o modo Whisper AI.');
        return;
      }
      const stream = await ensureMicrophoneStream();
      if (!stream) return;

      if (!state.recognition) {
        state.recognition = initNativeEngine();
      }
      try {
        state.manualStop = false;
        state.recognition.start();
      } catch (e) {}
    }
  }

  function stopListening() {
    state.manualStop = true;
    state.isListening = false;
    stopAudioWatchdog();

    if (state.config.engine === 'whisper') {
      stopWhisperContinuous();
    } else if (state.recognition) {
      try {
        state.recognition.abort(); // Interrompe imediatamente sem emitir novos onresult
      } catch (e) {
        try { state.recognition.stop(); } catch (err) {}
      }
      if (state.audioStream) {
        try {
          state.audioStream.getTracks().forEach((track) => {
            try { track.stop(); } catch (err) {}
          });
        } catch (e) {}
        state.audioStream = null;
      }
    }

    updateHudState('idle', msg('statusReady'));
  }

  function toggleListening() {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  // Atalho Global
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('voice-stt-shortcut-input')) return;

    if (matchesShortcut(e, state.config.shortcut || 'Alt+V')) {
      e.preventDefault();
      e.stopPropagation();
      toggleListening();
    }
  }, true);

  function matchesShortcut(event, shortcutStr) {
    const parts = shortcutStr.split('+').map((p) => p.trim().toLowerCase());
    const needsAlt = parts.includes('alt');
    const needsCtrl = parts.includes('ctrl') || parts.includes('control');
    const needsShift = parts.includes('shift');
    const needsMeta = parts.includes('cmd') || parts.includes('meta');
    const keyPart = parts.find((p) => !['alt', 'ctrl', 'control', 'shift', 'cmd', 'meta'].includes(p));

    if (needsAlt !== event.altKey) return false;
    if (needsCtrl !== event.ctrlKey) return false;
    if (needsShift !== event.shiftKey) return false;
    if (needsMeta !== event.metaKey) return false;
    if (keyPart) return event.key.toLowerCase() === keyPart;
    return true;
  }

  // =========================================================================
  // 7. GHOST STUDIO DOCK & UI (100% TRUSTEDTYPES-SAFE & INTERATIVO)
  // =========================================================================
  let hudElements = {};

  function createSvg(pathsData, width = 18, height = 18) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.pointerEvents = 'none';

    (Array.isArray(pathsData) ? pathsData : [pathsData]).forEach((item) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', item.tag || 'path');
      Object.keys(item.attrs || {}).forEach((attr) => {
        el.setAttribute(attr, item.attrs[attr]);
      });
      svg.appendChild(el);
    });
    return svg;
  }

  function createHUD() {
    const existing = document.getElementById('voice-stt-tampermonkey-root');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'voice-stt-tampermonkey-root';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '0';
    host.style.height = '0';
    host.style.overflow = 'visible';
    host.style.pointerEvents = 'none';

    (document.documentElement || document.body).appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; user-select: none; }

      /* Container Principal Flutuante */
      .stt-container {
        position: fixed;
        bottom: ${state.config.hudPos?.bottom || 24}px;
        right: ${state.config.hudPos?.right || 24}px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        pointer-events: auto;
      }

      /* Painel Ghost Studio Acoplado */
      .ghost-studio {
        width: 400px;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        overflow: hidden;
        display: none;
        flex-direction: column;
        animation: ghostSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        transition: transform 0.2s, opacity 0.2s;
      }

      .ghost-studio.open {
        display: flex !important;
      }

      @keyframes ghostSlideUp {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .ghost-header {
        padding: 10px 14px;
        background: rgba(30, 41, 59, 0.75);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .ghost-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #38bdf8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ghost-target-indicator {
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 4px;
        font-weight: 500;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ghost-target-indicator.has-target {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .ghost-target-indicator.no-target {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .ghost-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ghost-header-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 14px;
        cursor: pointer;
        padding: 3px 6px;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ghost-header-btn:hover { color: #ffffff; background: rgba(255, 255, 255, 0.12); }

      /* Área de Edição do Ghost Text */
      .ghost-body {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        user-select: auto;
      }

      .ghost-editor-input {
        width: 100%;
        min-height: 95px;
        max-height: 240px;
        background: #090d16;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 10px 12px;
        color: #f8fafc;
        font-size: 14px;
        line-height: 1.5;
        resize: vertical;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
        user-select: text;
      }

      .ghost-editor-input:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 1px #38bdf8;
      }

      .ghost-editor-input::placeholder {
        color: #64748b;
        font-size: 13px;
      }

      .ghost-meta-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        color: #64748b;
        padding: 0 2px;
      }

      .ghost-feedback-toast {
        font-weight: 600;
        opacity: 0;
        transition: opacity 0.2s;
      }

      /* Barra de Ações Rápidas */
      .ghost-actions {
        padding: 8px 14px 12px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }

      .ghost-actions-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ghost-actions-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ghost-btn {
        padding: 6px 12px;
        border-radius: 7px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        border: none;
        transition: all 0.15s ease;
      }

      .ghost-btn-mode {
        background: rgba(56, 189, 248, 0.1);
        border: 1px solid rgba(56, 189, 248, 0.25);
        color: #38bdf8;
        font-size: 11px;
      }
      .ghost-btn-mode:hover {
        background: rgba(56, 189, 248, 0.2);
        color: #ffffff;
      }

      .ghost-btn-clear {
        background: #1e293b;
        color: #94a3b8;
      }
      .ghost-btn-clear:hover { background: #334155; color: #ef4444; }

      .ghost-btn-copy {
        background: #1e293b;
        color: #cbd5e1;
      }
      .ghost-btn-copy:hover { background: #334155; color: #ffffff; }

      .ghost-btn-insert {
        background: #10b981;
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
      }
      .ghost-btn-insert:hover {
        background: #059669;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5);
      }

      /* Barra Flutuante Pílula Principal */
      .stt-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.08);
        border-radius: 9999px;
        padding: 5px 8px 5px 5px;
        color: #f8fafc;
        font-size: 13px;
        transition: border-color 0.25s, box-shadow 0.25s;
        cursor: grab;
      }

      .stt-bar:active { cursor: grabbing; }

      /* Respiração orgânica sem distorção oval */
      .stt-bar.listening {
        border-color: rgba(16, 185, 129, 0.85);
        box-shadow: 0 0 20px rgba(16, 185, 129, 0.35), 0 10px 25px rgba(0, 0, 0, 0.65);
        animation: barGlowBreath 2.2s infinite ease-in-out;
      }

      @keyframes barGlowBreath {
        0%, 100% {
          border-color: rgba(16, 185, 129, 0.6);
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.25), 0 10px 20px rgba(0, 0, 0, 0.6);
        }
        50% {
          border-color: rgba(16, 185, 129, 0.95);
          box-shadow: 0 0 24px rgba(16, 185, 129, 0.45), 0 10px 28px rgba(0, 0, 0, 0.75);
        }
      }

      .stt-bar.error {
        border-color: rgba(239, 68, 68, 0.85);
        box-shadow: 0 0 20px rgba(239, 68, 68, 0.35);
      }

      /* Botão Redondo com Pulso Circular Geométrico (NUNCA OVAL) */
      .stt-mic-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: #1e293b;
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        position: relative;
        outline: none;
        flex-shrink: 0;
      }

      .stt-mic-btn:hover {
        background: #334155;
        color: #f8fafc;
        transform: scale(1.05);
      }

      .stt-bar.listening .stt-mic-btn {
        background: #10b981;
        color: #ffffff;
        box-shadow: 0 0 14px rgba(16, 185, 129, 0.7);
      }

      .mic-pulse-ring {
        position: absolute;
        top: -4px;
        left: -4px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid #10b981;
        opacity: 0;
        pointer-events: none;
      }

      .stt-bar.listening .mic-pulse-ring {
        animation: micPulseAnimation 1.6s infinite cubic-bezier(0.24, 0, 0.38, 1);
      }

      @keyframes micPulseAnimation {
        0% { transform: scale(0.9); opacity: 0.9; }
        100% { transform: scale(1.5); opacity: 0; }
      }

      /* Equalizador Visual de Áudio (Barras que dançam com a voz) */
      .stt-equalizer {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 20px;
        padding: 0 2px;
        pointer-events: none;
      }

      .eq-bar {
        width: 3px;
        height: 4px;
        background: #10b981;
        border-radius: 2px;
        transition: height 0.08s ease;
      }

      .stt-info {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-right: 2px;
        pointer-events: none;
      }

      .stt-status-text {
        font-weight: 600;
        font-size: 12px;
        color: #e2e8f0;
        white-space: nowrap;
      }

      .stt-shortcut-badge {
        font-size: 10px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 1px 5px;
        border-radius: 4px;
        color: #94a3b8;
        font-family: monospace;
      }

      /* Botão para alternar visibilidade do Ghost Studio */
      .stt-ghost-toggle-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: #38bdf8;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .stt-ghost-toggle-btn:hover {
        background: rgba(56, 189, 248, 0.15);
        transform: scale(1.08);
      }

      .stt-settings-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        margin-left: -2px;
        flex-shrink: 0;
      }
      .stt-settings-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #f8fafc;
        transform: rotate(30deg);
      }

      /* Modal de Configurações Completa em Tabs */
      .stt-modal-backdrop {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.74); backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px); z-index: 2147483647; display: none;
        align-items: center; justify-content: center; pointer-events: auto;
      }
      .stt-modal-backdrop.open { display: flex !important; }
      .stt-modal {
        background: #0b1120; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px;
        width: 95%; max-width: 660px; max-height: 90vh; display: flex; flex-direction: column;
        color: #f8fafc; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(56, 189, 248, 0.12);
        user-select: auto; overflow: hidden;
      }
      .stt-modal-header {
        padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex; align-items: center; justify-content: space-between; background: #0b1120;
      }
      .stt-modal-header h3 { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: #ffffff; }
      .stt-modal-close {
        background: transparent; border: none; color: #94a3b8; font-size: 22px;
        cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1;
      }
      .stt-modal-close:hover { color: #ffffff; background: rgba(255, 255, 255, 0.1); }

      /* Navegação em Tabs */
      .stt-modal-tabs {
        display: flex; background: #070b14; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding: 6px 16px 0; gap: 6px;
      }
      .stt-tab-btn {
        background: transparent; border: none; border-bottom: 2px solid transparent;
        color: #94a3b8; padding: 10px 14px; font-size: 13px; font-weight: 500;
        cursor: pointer; display: flex; align-items: center; gap: 6px;
        transition: all 0.2s ease; border-radius: 8px 8px 0 0;
      }
      .stt-tab-btn:hover { color: #f1f5f9; background: rgba(255, 255, 255, 0.04); }
      .stt-tab-btn.active {
        color: #38bdf8; border-bottom-color: #38bdf8; background: rgba(56, 189, 248, 0.08);
        font-weight: 600;
      }

      .stt-modal-body {
        padding: 18px 20px; overflow-y: auto; max-height: calc(90vh - 145px);
        display: flex; flex-direction: column;
      }
      .stt-tab-pane { display: none; flex-direction: column; gap: 14px; }
      .stt-tab-pane.active { display: flex; }

      .stt-section-title {
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.08em; color: #38bdf8; margin-top: 4px; padding-bottom: 4px;
        border-bottom: 1px solid rgba(56, 189, 248, 0.2);
      }

      .stt-setting-row {
        display: flex; align-items: center; justify-content: space-between; background: #1e293b;
        padding: 11px 14px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .stt-setting-label { font-size: 13px; font-weight: 500; color: #f1f5f9; }
      .stt-setting-desc { font-size: 11px; color: #94a3b8; margin-top: 2px; }

      .stt-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
      .stt-switch input { opacity: 0; width: 0; height: 0; }
      .stt-slider {
        position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
        background-color: #334155; transition: .25s ease; border-radius: 24px;
      }
      .stt-slider:before {
        position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
        background-color: #ffffff; transition: .25s ease; border-radius: 50%;
      }
      input:checked + .stt-slider { background-color: #10b981; }
      input:checked + .stt-slider:before { transform: translateX(20px); }

      .stt-switch-sm { width: 34px; height: 18px; }
      .stt-switch-sm .stt-slider:before { height: 12px; width: 12px; left: 3px; bottom: 3px; }
      .stt-switch-sm input:checked + .stt-slider:before { transform: translateX(16px); }

      .stt-input-text, .stt-select {
        background: #0f172a; border: 1px solid #334155; color: #f8fafc;
        padding: 7px 12px; border-radius: 8px; font-size: 13px; outline: none;
      }
      .stt-input-text:focus, .stt-select:focus { border-color: #38bdf8; }

      /* Barra de Ferramentas: Busca + Botão Adicionar */
      .stt-toolbar {
        display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
      }
      .stt-search-box { position: relative; flex: 1; min-width: 200px; }
      .stt-search-input {
        width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155;
        color: #f8fafc; padding: 8px 12px; border-radius: 8px; font-size: 12px; outline: none;
        transition: border-color 0.2s;
      }
      .stt-search-input:focus { border-color: #38bdf8; }
      .stt-btn-add-primary {
        background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; border: none;
        padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;
        display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
        transition: all 0.2s; white-space: nowrap;
      }
      .stt-btn-add-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5); }
      .stt-btn-add-primary:active { transform: translateY(0); }

      /* Chips de Pontuações Rápidas */
      .stt-chips-row {
        display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 10px;
        background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px;
      }
      .stt-chips-label { font-size: 11px; color: #94a3b8; font-weight: 600; margin-right: 2px; }
      .stt-chip-btn {
        background: #1e293b; border: 1px solid #334155; color: #38bdf8; font-size: 11px;
        padding: 3px 8px; border-radius: 6px; cursor: pointer; transition: all 0.15s;
      }
      .stt-chip-btn:hover { background: #334155; color: #7dd3fc; border-color: #38bdf8; transform: scale(1.04); }

      /* Chips de Dynamic Templates (Text Blaze para Áudio) */
      .stt-chip-template {
        background: rgba(99, 102, 241, 0.16); border: 1px solid rgba(129, 140, 248, 0.35); color: #c7d2fe;
        font-size: 11px; padding: 3px 8px; border-radius: 6px; cursor: pointer; transition: all 0.15s;
        display: inline-flex; align-items: center; gap: 3px; font-weight: 500;
      }
      .stt-chip-template:hover {
        background: rgba(99, 102, 241, 0.32); color: #ffffff; border-color: #818cf8; transform: scale(1.04);
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
      }

      .stt-cmd-counter { font-size: 11px; color: #94a3b8; font-weight: 500; }

      /* Tabela de Mensagens Editáveis */
      .stt-messages-list { display: flex; flex-direction: column; gap: 8px; }
      .stt-msg-row {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        background: #1e293b; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .stt-msg-key { font-size: 12px; font-weight: 500; color: #cbd5e1; flex: 1.1; }
      .stt-msg-val { flex: 1.5; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none; }
      .stt-msg-val:focus { border-color: #38bdf8; }

      /* Comandos e Pontuações com Toggle Individual */
      .stt-commands-list { display: flex; flex-direction: column; gap: 6px; max-height: 330px; overflow-y: auto; padding-right: 4px; }
      .stt-cmd-item {
        display: flex; align-items: center; gap: 8px; background: #1e293b;
        padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);
        transition: all 0.2s ease;
      }
      .stt-cmd-item.disabled { opacity: 0.52; border-color: rgba(255, 255, 255, 0.02); }
      .stt-cmd-status-badge {
        font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;
        min-width: 44px; text-align: center; user-select: none;
      }
      .stt-cmd-status-badge.active {
        background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25);
      }
      .stt-cmd-status-badge.inactive {
        background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.15);
      }
      .stt-cmd-item input[type="text"] {
        background: #0f172a; border: 1px solid #334155; color: #f8fafc;
        padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none; transition: border-color 0.15s;
      }
      .stt-cmd-item input[type="text"]:focus { border-color: #38bdf8; }
      .stt-cmd-spoken { flex: 1.2; }
      .stt-cmd-replace { flex: 1; }
      .stt-cmd-arrow { color: #64748b; font-size: 12px; flex-shrink: 0; }
      .stt-btn-del {
        background: transparent; border: none; color: #94a3b8; cursor: pointer;
        padding: 4px 6px; border-radius: 4px; font-size: 14px; transition: all 0.15s;
      }
      .stt-btn-del:hover { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

      @keyframes sttHighlightPulse {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.85); border-color: #10b981; }
        50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); border-color: #10b981; }
        100% { box-shadow: none; border-color: rgba(255, 255, 255, 0.06); }
      }
      .stt-guide-card {
        background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(56, 189, 248, 0.2);
        border-radius: 8px; padding: 10px 14px; font-size: 12px;
      }
      .stt-guide-title { font-weight: 600; color: #38bdf8; margin-bottom: 6px; font-size: 12px; }
      .stt-guide-body { color: #cbd5e1; line-height: 1.5; font-size: 11px; display: flex; flex-direction: column; gap: 3px; }
      .stt-guide-body code { background: #0f172a; padding: 1px 5px; border-radius: 4px; color: #a5b4fc; font-family: monospace; font-size: 11px; }

      .stt-preset-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .stt-preset-btn {
        background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #6ee7b7;
        font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s;
      }
      .stt-preset-btn:hover { background: rgba(16, 185, 129, 0.25); color: #ffffff; border-color: #10b981; transform: translateY(-1px); }

      .stt-cmd-header-row {
        display: flex; align-items: center; gap: 8px; padding: 6px 10px;
        font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.5px;
        background: rgba(15, 23, 42, 0.4); border-radius: 6px;
      }
      .stt-th-status { width: 88px; }
      .stt-th-spoken { flex: 1.2; }
      .stt-th-arrow { width: 14px; text-align: center; }
      .stt-th-replace { flex: 1; }
      .stt-th-del { width: 24px; text-align: center; }

      .stt-dict-test-box {
        margin-top: 6px; padding: 10px; background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;
      }

      .stt-modal-footer {
        padding: 14px 20px; border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex; justify-content: space-between; align-items: center; gap: 10px; background: #0b1120;
      }
      .stt-footer-actions { display: flex; align-items: center; gap: 10px; }
      .stt-btn-reset { background: transparent; color: #94a3b8; border: 1px solid #334155; padding: 8px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; }
      .stt-btn-reset:hover { color: #ef4444; border-color: #ef4444; }
      .stt-btn-save { background: #10b981; color: #ffffff; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .stt-btn-save:hover { background: #059669; }
      .stt-btn-cancel { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; }
      .stt-btn-cancel:hover { background: #334155; }
    `;
    shadow.appendChild(style);

    // Container Geral
    const container = document.createElement('div');
    container.className = 'stt-container';

    // 1. Painel Ghost Studio
    const ghostStudio = document.createElement('div');
    ghostStudio.className = 'ghost-studio';

    const ghostHeader = document.createElement('div');
    ghostHeader.className = 'ghost-header';

    const ghostTitleBox = document.createElement('div');
    ghostTitleBox.className = 'ghost-header-left';
    ghostTitleBox.appendChild(createSvg([
      { tag: 'path', attrs: { d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' } },
      { tag: 'path', attrs: { d: 'M19 10v2a7 7 0 0 1-14 0v-2' } }
    ], 14, 14));
    const ghostTitleSpan = document.createElement('span');
    ghostTitleSpan.textContent = msg('ghostTitle');
    ghostTitleBox.appendChild(ghostTitleSpan);

    const ghostTargetBadge = document.createElement('span');
    ghostTargetBadge.className = 'ghost-target-indicator no-target';
    ghostTargetBadge.textContent = msg('targetNoneBadge');
    ghostTitleBox.appendChild(ghostTargetBadge);

    const ghostHeaderActions = document.createElement('div');
    ghostHeaderActions.className = 'ghost-header-actions';

    const ghostSettingsBtn = document.createElement('button');
    ghostSettingsBtn.className = 'ghost-header-btn';
    ghostSettingsBtn.type = 'button';
    ghostSettingsBtn.title = msg('tooltipSettings');
    ghostSettingsBtn.appendChild(createSvg([
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
      { tag: 'path', attrs: { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' } }
    ], 13, 13));

    const ghostCloseBtn = document.createElement('button');
    ghostCloseBtn.className = 'ghost-header-btn';
    ghostCloseBtn.type = 'button';
    ghostCloseBtn.textContent = '✕';
    ghostCloseBtn.title = msg('tooltipCloseGhost');

    ghostHeaderActions.appendChild(ghostSettingsBtn);
    ghostHeaderActions.appendChild(ghostCloseBtn);

    ghostHeader.appendChild(ghostTitleBox);
    ghostHeader.appendChild(ghostHeaderActions);
    ghostStudio.appendChild(ghostHeader);

    const ghostBody = document.createElement('div');
    ghostBody.className = 'ghost-body';

    const ghostEditor = document.createElement('textarea');
    ghostEditor.className = 'ghost-editor-input';
    ghostEditor.placeholder = msg('ghostPlaceholder');
    ghostBody.appendChild(ghostEditor);

    const ghostMeta = document.createElement('div');
    ghostMeta.className = 'ghost-meta-bar';
    const ghostCounter = document.createElement('span');
    ghostCounter.textContent = msg('counterTemplate', { words: 0, chars: 0 });
    const ghostFeedback = document.createElement('span');
    ghostFeedback.className = 'ghost-feedback-toast';
    ghostMeta.appendChild(ghostCounter);
    ghostMeta.appendChild(ghostFeedback);
    ghostBody.appendChild(ghostMeta);
    ghostStudio.appendChild(ghostBody);

    const ghostActions = document.createElement('div');
    ghostActions.className = 'ghost-actions';

    const actionsLeft = document.createElement('div');
    actionsLeft.className = 'ghost-actions-left';

    const btnModeGhost = document.createElement('button');
    btnModeGhost.className = 'ghost-btn ghost-btn-mode';
    btnModeGhost.type = 'button';
    btnModeGhost.textContent = state.config.outputMode === 'ghost' ? msg('btnModeGhost') : msg('btnModeDirect');
    btnModeGhost.title = 'Alternar rapidamente entre Modo Ghost e Modo Direto';
    actionsLeft.appendChild(btnModeGhost);

    const btnClearGhost = document.createElement('button');
    btnClearGhost.className = 'ghost-btn ghost-btn-clear';
    btnClearGhost.type = 'button';
    btnClearGhost.textContent = msg('btnClear');
    actionsLeft.appendChild(btnClearGhost);

    const actionsRight = document.createElement('div');
    actionsRight.className = 'ghost-actions-right';

    const btnCopyGhost = document.createElement('button');
    btnCopyGhost.className = 'ghost-btn ghost-btn-copy';
    btnCopyGhost.type = 'button';
    btnCopyGhost.textContent = msg('btnCopy');
    actionsRight.appendChild(btnCopyGhost);

    const btnInsertGhost = document.createElement('button');
    btnInsertGhost.className = 'ghost-btn ghost-btn-insert';
    btnInsertGhost.type = 'button';
    btnInsertGhost.textContent = msg('btnInsert');
    actionsRight.appendChild(btnInsertGhost);

    ghostActions.appendChild(actionsLeft);
    ghostActions.appendChild(actionsRight);
    ghostStudio.appendChild(ghostActions);
    container.appendChild(ghostStudio);

    // 2. Barra Flutuante Pílula
    const bar = document.createElement('div');
    bar.className = 'stt-bar';

    const micBtn = document.createElement('button');
    micBtn.className = 'stt-mic-btn';
    micBtn.type = 'button';
    micBtn.title = msg('tooltipMic', { shortcut: state.config.shortcut || 'Alt+V' });

    const micPulse = document.createElement('div');
    micPulse.className = 'mic-pulse-ring';
    micBtn.appendChild(micPulse);

    const micSvg = createSvg([
      { tag: 'path', attrs: { d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' } },
      { tag: 'path', attrs: { d: 'M19 10v2a7 7 0 0 1-14 0v-2' } },
      { tag: 'line', attrs: { x1: '12', x2: '12', y1: '19', y2: '22' } }
    ], 18, 18);
    micBtn.appendChild(micSvg);
    bar.appendChild(micBtn);

    // Equalizador dinâmico
    const eqContainer = document.createElement('div');
    eqContainer.className = 'stt-equalizer';
    const waveBars = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('div');
      b.className = 'eq-bar';
      eqContainer.appendChild(b);
      waveBars.push(b);
    }
    bar.appendChild(eqContainer);

    const info = document.createElement('div');
    info.className = 'stt-info';
    const statusText = document.createElement('span');
    statusText.className = 'stt-status-text';
    statusText.textContent = state.config.engine === 'whisper' ? msg('statusWhisperReady') : msg('statusReady');
    info.appendChild(statusText);

    const shortcutBadge = document.createElement('span');
    shortcutBadge.className = 'stt-shortcut-badge';
    shortcutBadge.textContent = state.config.shortcut || 'Alt+V';
    info.appendChild(shortcutBadge);
    bar.appendChild(info);

    // Botão para abrir/fechar o Ghost Studio
    const ghostToggleBtn = document.createElement('button');
    ghostToggleBtn.className = 'stt-ghost-toggle-btn';
    ghostToggleBtn.type = 'button';
    ghostToggleBtn.title = msg('tooltipGhost');
    const ghostSvg = createSvg([
      { tag: 'path', attrs: { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' } },
      { tag: 'polyline', attrs: { points: '14 2 14 8 20 8' } },
      { tag: 'line', attrs: { x1: '16', x2: '8', y1: '13', y2: '13' } },
      { tag: 'line', attrs: { x1: '16', x2: '8', y1: '17', y2: '17' } }
    ], 15, 15);
    ghostToggleBtn.appendChild(ghostSvg);
    bar.appendChild(ghostToggleBtn);

    // Botão de Configurações
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'stt-settings-btn';
    settingsBtn.type = 'button';
    settingsBtn.title = msg('tooltipSettings');
    const gearSvg = createSvg([
      { tag: 'path', attrs: { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' } },
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } }
    ], 15, 15);
    settingsBtn.appendChild(gearSvg);
    bar.appendChild(settingsBtn);

    container.appendChild(bar);
    shadow.appendChild(container);

    // 3. Modal de Configurações
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'stt-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'stt-modal';

    const header = document.createElement('div');
    header.className = 'stt-modal-header';
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = msg('modalTitle');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'stt-modal-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // 2. Barra de Abas (Tabs)
    const tabsBar = document.createElement('div');
    tabsBar.className = 'stt-modal-tabs';

    const createTabBtn = (tabId, labelText, isActive = false) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `stt-tab-btn ${isActive ? 'active' : ''}`;
      btn.dataset.tab = tabId;
      btn.textContent = labelText;
      btn.addEventListener('click', () => switchTab(tabId));
      return btn;
    };

    const tabBtnGeneral = createTabBtn('general', msg('tabGeneral'), true);
    const tabBtnDict = createTabBtn('dictionary', msg('tabDictionary'), false);
    const tabBtnMsgs = createTabBtn('messages', msg('tabMessages'), false);

    tabsBar.appendChild(tabBtnGeneral);
    tabsBar.appendChild(tabBtnDict);
    tabsBar.appendChild(tabBtnMsgs);
    modal.appendChild(tabsBar);

    // 3. Corpo da Modal com Abas
    const body = document.createElement('div');
    body.className = 'stt-modal-body';

    // --- ABA 1: GERAL & MOTOR ---
    const paneGeneral = document.createElement('div');
    paneGeneral.className = 'stt-tab-pane active';
    paneGeneral.dataset.tab = 'general';

    paneGeneral.appendChild(createSectionHeader(msg('tabGeneralTitle')));

    paneGeneral.appendChild(createSettingRow(
      'Mecanismo de Transcrição',
      'Whisper AI (Groq - perfeito para Brave) ou Google Web Speech (Chrome/Edge)',
      () => {
        const select = document.createElement('select');
        select.className = 'stt-select';
        select.id = 'stt-cfg-engine';
        select.add(new Option('Whisper AI (Groq Cloud - Funciona no Brave)', 'whisper'));
        select.add(new Option('Google Web Speech (Chrome / Edge Nativo)', 'native'));
        select.value = state.config.engine || (isBrave ? 'whisper' : 'native');
        return select;
      }
    ));

    paneGeneral.appendChild(createSettingRow(
      'Chave API Groq (Whisper Grátis)',
      'Obtenha grátis em console.groq.com/keys (essencial para Brave Browser)',
      () => {
        const inp = document.createElement('input');
        inp.type = 'password';
        inp.className = 'stt-input-text';
        inp.id = 'stt-cfg-groqkey';
        inp.placeholder = 'gsk_...';
        inp.value = state.config.groqApiKey || '';
        inp.style.width = '180px';
        return inp;
      }
    ));

    paneGeneral.appendChild(createSettingRow(
      'Atalho Global',
      'Pressione a combinação de teclas no campo',
      () => {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'stt-input-text voice-stt-shortcut-input';
        inp.id = 'stt-cfg-shortcut';
        inp.value = state.config.shortcut || 'Alt+V';
        inp.style.width = '110px';
        inp.style.textAlign = 'center';
        return inp;
      }
    ));

    paneGeneral.appendChild(createSettingRow(
      'Modo de Saída Padrão',
      'Ghost Studio (ver, editar e enviar) ou Direto na Caixa de Texto',
      () => {
        const select = document.createElement('select');
        select.className = 'stt-select';
        select.id = 'stt-cfg-outputmode';
        select.add(new Option('Ghost Studio (Ver e Editar antes de Enviar)', 'ghost'));
        select.add(new Option('Direto no Campo (Injeção Imediata)', 'direct'));
        select.value = state.config.outputMode || 'ghost';
        return select;
      }
    ));

    paneGeneral.appendChild(createSwitchRow(
      'Abrir Ghost Studio Automaticamente ao Falar',
      'Abre o dock de edição flutuante assim que a fala for detectada',
      'stt-cfg-autoghost',
      state.config.autoOpenGhostOnSpeech !== false
    ));

    paneGeneral.appendChild(createSwitchRow(
      'Efeitos Sonoros (Sintetizador Web Audio)',
      'Sons de feedback suaves ao ligar, desligar e inserir texto',
      'stt-cfg-soundfx',
      !!state.config.soundFx
    ));

    paneGeneral.appendChild(createSettingRow(
      'Pausa de Fala do VAD (Silêncio antes de Processar)',
      'Tempo de silêncio contínuo para considerar o término de uma frase (padrão 1200ms). Evita cortar enquanto você respira.',
      () => {
        const select = document.createElement('select');
        select.className = 'stt-select';
        select.id = 'stt-cfg-vadpause';
        select.add(new Option('800ms (Mais Rápido)', '800'));
        select.add(new Option('1200ms (Padrão Fluido - Recomendado)', '1200'));
        select.add(new Option('1600ms (Pausado / Pensativo)', '1600'));
        select.add(new Option('2000ms (Frases Longas)', '2000'));
        select.value = String(state.config.vadSilencePauseMs || 1200);
        return select;
      }
    ));

    paneGeneral.appendChild(createSettingRow(
      'Duração Máxima Contínua da Frase',
      'Teto de gravação de uma frase inteira (ms). Evita fatiar palavras no meio do raciocínio.',
      () => {
        const select = document.createElement('select');
        select.className = 'stt-select';
        select.id = 'stt-cfg-vadmax';
        select.add(new Option('6 segundos (6000ms)', '6000'));
        select.add(new Option('12 segundos (12000ms - Recomendado)', '12000'));
        select.add(new Option('18 segundos (18000ms)', '18000'));
        select.add(new Option('25 segundos (25000ms)', '25000'));
        select.value = String(state.config.vadMaxSliceDurationMs || 12000);
        return select;
      }
    ));

    paneGeneral.appendChild(createSwitchRow(
      'Watchdog Auto-Recuperador de Áudio',
      'Monitor em tempo real que descongela o microfone, restaura o contexto de áudio e destrava o gravador caso o navegador trave a aba',
      'stt-cfg-autorecover',
      state.config.autoRecoverAudio !== false
    ));

    body.appendChild(paneGeneral);

    // --- ABA 2: DICIONÁRIO & PONTUAÇÕES ---
    const paneDict = document.createElement('div');
    paneDict.className = 'stt-tab-pane';
    paneDict.dataset.tab = 'dictionary';

    paneDict.appendChild(createSectionHeader(msg('tabDictionaryTitle')));

    // Controles Globais de Pontuação
    paneDict.appendChild(createSwitchRow(
      'Comandos de Pontuação por Voz',
      'Converte palavras faladas como "vírgula", "ponto", "pular linha" em símbolos',
      'stt-cfg-punctuation',
      !!state.config.enablePunctuationCommands
    ));

    paneDict.appendChild(createSwitchRow(
      'Pontuação Automática da IA (Whisper)',
      'Desative para pontuar estritamente com seus comandos de voz falados',
      'stt-cfg-aipunctuation',
      !!state.config.aiPunctuation
    ));

    paneDict.appendChild(createSwitchRow(
      'Auto-Capitalização',
      'Inicia frases com letra maiúscula',
      'stt-cfg-capitalize',
      !!state.config.autoCapitalize
    ));

    paneDict.appendChild(createSwitchRow(
      'Espaçamento Automático após Pontuação',
      'Garante um espaço inteligente após vírgulas, pontos e sinais',
      'stt-cfg-trailingspace',
      state.config.addTrailingSpace !== false
    ));

    // Barra de Ferramentas: Busca + Botão Adicionar Comando
    const dictToolbar = document.createElement('div');
    dictToolbar.className = 'stt-toolbar';

    const searchBox = document.createElement('div');
    searchBox.className = 'stt-search-box';
    const cmdSearchInp = document.createElement('input');
    cmdSearchInp.type = 'text';
    cmdSearchInp.className = 'stt-search-input';
    cmdSearchInp.id = 'stt-cmd-search-input';
    cmdSearchInp.placeholder = msg('searchCommandsPlaceholder');
    searchBox.appendChild(cmdSearchInp);
    dictToolbar.appendChild(searchBox);

    const btnAddCmd = document.createElement('button');
    btnAddCmd.className = 'stt-btn-add-primary';
    btnAddCmd.type = 'button';
    btnAddCmd.innerHTML = `<span>${msg('btnAddNewCommand')}</span>`;
    dictToolbar.appendChild(btnAddCmd);
    paneDict.appendChild(dictToolbar);

    // Quick Chips (Pontuações Rápidas com 1 clique)
    const chipsRow = document.createElement('div');
    chipsRow.className = 'stt-chips-row';
    const chipsLabel = document.createElement('span');
    chipsLabel.className = 'stt-chips-label';
    chipsLabel.textContent = msg('quickChipsTitle');
    chipsRow.appendChild(chipsLabel);

    const defaultQuickPuncts = [
      { spoken: 'vírgula', replace: ', ' },
      { spoken: 'ponto final', replace: '. ' },
      { spoken: 'interrogação', replace: '? ' },
      { spoken: 'exclamação', replace: '! ' },
      { spoken: 'dois pontos', replace: ': ' },
      { spoken: 'ponto e vírgula', replace: '; ' },
      { spoken: 'reticências', replace: '... ' },
      { spoken: 'pular linha', replace: '\n' },
      { spoken: 'novo parágrafo', replace: '\n\n' },
      { spoken: 'abrir aspas', replace: '"' },
      { spoken: 'traço', replace: ' - ' },
      { spoken: 'abrir parênteses', replace: ' (' }
    ];

    defaultQuickPuncts.forEach((qp) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'stt-chip-btn';
      const labelText = qp.replace === '\n' ? '\\n (Linha)' : (qp.replace === '\n\n' ? '\\n\\n (Parágrafo)' : qp.replace);
      chip.textContent = `${qp.spoken} (${labelText})`;
      chip.addEventListener('click', () => {
        addOrActivatePunctuation(qp.spoken, qp.replace);
      });
      chipsRow.appendChild(chip);
    });
    paneDict.appendChild(chipsRow);

    // Dynamic Templates Chips (Estilo Text Blaze para Áudio)
    const templatesRow = document.createElement('div');
    templatesRow.className = 'stt-chips-row';
    templatesRow.style.marginTop = '6px';
    const templatesLabel = document.createElement('span');
    templatesLabel.className = 'stt-chips-label';
    templatesLabel.style.color = '#a5b4fc';
    templatesLabel.textContent = msg('dynamicTemplatesTitle');
    templatesRow.appendChild(templatesLabel);

    const defaultDynamicTemplates = [
      { label: '🎯 {cursor}', tag: '{cursor}' },
      { label: '↵ Quebra (\\n)', tag: '\\n' },
      { label: '↵↵ Parágrafo (\\n\\n)', tag: '\\n\\n' },
      { label: '👋 {saudacao}', tag: '{saudacao}' },
      { label: '📅 {data}', tag: '{data}' },
      { label: '⏰ {hora}', tag: '{hora}' },
      { label: '📆 {data:iso}', tag: '{data:iso}' },
      { label: '🌅 {data:+1d}', tag: '{data:+1d}' },
      { label: '🗓️ {dia_semana}', tag: '{dia_semana}' },
      { label: '🌐 {site}', tag: '{site}' },
      { label: '🔗 {url}', tag: '{url}' },
      { label: '🏷️ {titulo}', tag: '{titulo}' },
      { label: '🧮 {calc: 10*5}', tag: '{calc: 10*5}' },
      { label: '🎲 {random: A | B}', tag: '{random: Opção A | Opção B}' }
    ];

    defaultDynamicTemplates.forEach((dt) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'stt-chip-template';
      chip.textContent = dt.label;
      chip.title = `Clique para inserir ${dt.tag} no template focado ou criar novo comando`;
      chip.addEventListener('click', () => {
        insertDynamicTemplateTag(dt.tag);
      });
      templatesRow.appendChild(chip);
    });
    paneDict.appendChild(templatesRow);

    // Card Explicativo de Como Configurar Templates
    const guideCard = document.createElement('div');
    guideCard.className = 'stt-guide-card';
    guideCard.innerHTML = `
      <div class="stt-guide-title">⚡ Como Configurar Templates & Comandos de Voz:</div>
      <div class="stt-guide-body">
        <div>• <b>Comando de Voz:</b> Digite no campo da esquerda o que você vai falar (ex: <i>palavra trabalhando</i> ou <i>pular linha</i>).</div>
        <div>• <b>Texto / Template:</b> Digite no campo da direita o que será escrito automaticamente.</div>
        <div>• <b>🎯 {cursor}:</b> Posiciona o cursor de texto exatamente onde a tag for inserida (ex: <code>Olá "{cursor}" estamos trabalhando nisso!</code>).</div>
        <div>• <b>↵ \\n e ↵↵ \\n\\n:</b> Cria quebras de linha e novos parágrafos em qualquer campo de texto ou editor rico.</div>
        <div>• <b>Tags Dinâmicas:</b> Clique nos chips acima para inserir <code>{data}</code>, <code>{hora}</code>, <code>{saudacao}</code>, <code>{site}</code>, <code>{url}</code>.</div>
      </div>
    `;
    paneDict.appendChild(guideCard);

    // Botões de Presets Rápidos
    const presetRow = document.createElement('div');
    presetRow.className = 'stt-preset-row';
    const presetLabel = document.createElement('span');
    presetLabel.className = 'stt-chips-label';
    presetLabel.textContent = 'Criar Rápido:';
    presetRow.appendChild(presetLabel);

    const presets = [
      { label: '+ Template com {cursor}', spoken: 'meu template', replace: 'Olá "{cursor}" estamos trabalhando nisso!' },
      { label: '+ Assinatura Multilinha', spoken: 'minha assinatura', replace: 'Atenciosamente,\ndj\n{saudacao}! {data}' },
      { label: '+ Quebra de Linha', spoken: 'pular linha', replace: '\n' },
      { label: '+ Novo Parágrafo', spoken: 'novo parágrafo', replace: '\n\n' }
    ];

    presets.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stt-preset-btn';
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        const newRow = renderCommandRow({ spoken: p.spoken, replace: p.replace, enabled: true }, true);
        newRow.classList.add('highlight-pulse');
        const spokenInp = newRow.querySelector('.stt-cmd-spoken');
        if (spokenInp) spokenInp.focus();
        newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        updateCommandsCount();
        flashFeedback('✓ Novo template adicionado! Você pode alterar o comando e o texto agora.', false);
      });
      presetRow.appendChild(btn);
    });
    paneDict.appendChild(presetRow);

    // Cabeçalho das Colunas da Tabela
    const listHeader = document.createElement('div');
    listHeader.className = 'stt-cmd-header-row';
    listHeader.innerHTML = `
      <span class="stt-th-status">STATUS</span>
      <span class="stt-th-spoken">O QUE VOCÊ FALA (COMANDO)</span>
      <span class="stt-th-arrow">➔</span>
      <span class="stt-th-replace">O QUE É ESCRITO (TEXTO / TEMPLATE)</span>
      <span class="stt-th-del">AÇÃO</span>
    `;
    paneDict.appendChild(listHeader);

    // Contador de comandos
    const cmdCounterBox = document.createElement('div');
    cmdCounterBox.className = 'stt-cmd-counter';
    cmdCounterBox.id = 'stt-cmd-counter';
    paneDict.appendChild(cmdCounterBox);

    // Lista de Comandos
    const cmdList = document.createElement('div');
    cmdList.className = 'stt-commands-list';
    cmdList.id = 'stt-commands-container';
    paneDict.appendChild(cmdList);

    // Teste Rápido no Dicionário
    const dictTestBox = document.createElement('div');
    dictTestBox.className = 'stt-dict-test-box';
    dictTestBox.innerHTML = `
      <div style="font-size: 11px; font-weight: 600; color: #38bdf8; margin-bottom: 6px;">🧪 Teste Rápido de Comandos & Templates:</div>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <input type="text" id="stt-dict-test-input" placeholder="Clique aqui e fale qualquer comando ou teste com os botões ao lado..." style="flex: 1; min-width: 200px; background: #0f172a; border: 1px solid #334155; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none;">
        <button type="button" class="stt-chip-btn" id="stt-btn-test-pular" style="color: #34d399;">Testar "pular linha"</button>
        <button type="button" class="stt-chip-btn" id="stt-btn-test-parag" style="color: #34d399;">Testar "novo parágrafo"</button>
        <button type="button" class="stt-chip-btn" id="stt-btn-test-cursor" style="color: #fda4af;">Testar "{cursor}"</button>
      </div>
    `;
    paneDict.appendChild(dictTestBox);

    body.appendChild(paneDict);

    // --- ABA 3: MENSAGENS & TEXTOS ---
    const paneMsgs = document.createElement('div');
    paneMsgs.className = 'stt-tab-pane';
    paneMsgs.dataset.tab = 'messages';

    paneMsgs.appendChild(createSectionHeader(msg('tabMessagesTitle')));

    const msgSearchBox = document.createElement('div');
    msgSearchBox.className = 'stt-search-box';
    const msgSearchInp = document.createElement('input');
    msgSearchInp.type = 'text';
    msgSearchInp.className = 'stt-search-input';
    msgSearchInp.id = 'stt-msg-search-input';
    msgSearchInp.placeholder = msg('searchMessagesPlaceholder');
    msgSearchBox.appendChild(msgSearchInp);
    paneMsgs.appendChild(msgSearchBox);

    const msgContainer = document.createElement('div');
    msgContainer.className = 'stt-messages-list';
    msgContainer.id = 'stt-messages-container';
    paneMsgs.appendChild(msgContainer);

    body.appendChild(paneMsgs);

    modal.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'stt-modal-footer';

    const btnReset = document.createElement('button');
    btnReset.className = 'stt-btn-reset';
    btnReset.type = 'button';
    btnReset.textContent = msg('btnResetDefaults');
    footer.appendChild(btnReset);

    const footerRight = document.createElement('div');
    footerRight.className = 'stt-footer-actions';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'stt-btn-cancel';
    btnCancel.type = 'button';
    btnCancel.textContent = msg('btnCancelSettings');
    const btnSave = document.createElement('button');
    btnSave.className = 'stt-btn-save';
    btnSave.type = 'button';
    btnSave.textContent = msg('btnSaveSettings');
    footerRight.appendChild(btnCancel);
    footerRight.appendChild(btnSave);
    footer.appendChild(footerRight);
    modal.appendChild(footer);

    modalBackdrop.appendChild(modal);
    shadow.appendChild(modalBackdrop);

    // Mapeamento de Elementos
    hudElements = {
      container,
      bar,
      micBtn,
      waveBars,
      statusText,
      shortcutBadge,
      ghostToggleBtn,
      settingsBtn,
      ghostStudio,
      ghostTitleSpan,
      ghostCloseBtn,
      ghostSettingsBtn,
      ghostTargetBadge,
      ghostInput: ghostEditor,
      ghostCounter,
      ghostFeedback,
      btnModeGhost,
      btnInsertGhost,
      btnCopyGhost,
      btnClearGhost,
      modalBackdrop,
      modalTitle: headerTitle,
      modalClose: closeBtn,
      btnReset,
      btnCancel,
      btnSave,
      btnAddCmd,
      commandsContainer: cmdList,
      messagesContainer: msgContainer,
      cfgEngine: shadow.querySelector('#stt-cfg-engine'),
      cfgGroqKey: shadow.querySelector('#stt-cfg-groqkey'),
      cfgShortcut: shadow.querySelector('#stt-cfg-shortcut'),
      cfgOutputMode: shadow.querySelector('#stt-cfg-outputmode'),
      cfgAutoGhost: shadow.querySelector('#stt-cfg-autoghost'),
      cfgAiPunctuation: shadow.querySelector('#stt-cfg-aipunctuation'),
      cfgPunctuation: shadow.querySelector('#stt-cfg-punctuation'),
      cfgCapitalize: shadow.querySelector('#stt-cfg-capitalize'),
      cfgTrailingSpace: shadow.querySelector('#stt-cfg-trailingspace'),
      cfgSoundFx: shadow.querySelector('#stt-cfg-soundfx'),
      cfgVadPause: shadow.querySelector('#stt-cfg-vadpause'),
      cfgVadMax: shadow.querySelector('#stt-cfg-vadmax'),
      cfgAutoRecover: shadow.querySelector('#stt-cfg-autorecover')
    };

    // Eventos do HUD & Ghost Studio
    micBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleListening(); });
    settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); openSettingsModal(); });
    ghostSettingsBtn.addEventListener('click', (e) => { e.stopPropagation(); openSettingsModal(); });
    ghostToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isGhostOpen ? closeGhostDock() : openGhostDock();
    });
    ghostCloseBtn.addEventListener('click', closeGhostDock);

    btnModeGhost.addEventListener('click', toggleOutputMode);
    btnInsertGhost.addEventListener('click', injectGhostToTarget);
    btnCopyGhost.addEventListener('click', copyGhostToClipboard);
    btnClearGhost.addEventListener('click', clearGhost);

    // Digitação e teclas de atalho no Ghost Textarea
    ghostEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        injectGhostToTarget();
      }
      if (e.key === 'Escape') {
        closeGhostDock();
      }
    });

    ghostEditor.addEventListener('input', () => {
      state.ghostText = ghostEditor.value;
      updateGhostCounters();
    });

    // Eventos da Modal de Configurações
    closeBtn.addEventListener('click', closeSettingsModal);
    btnCancel.addEventListener('click', closeSettingsModal);
    btnReset.addEventListener('click', resetToDefaults);
    modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeSettingsModal(); });
    btnSave.addEventListener('click', saveModalSettings);

    btnAddCmd.addEventListener('click', () => {
      const newRow = renderCommandRow({ spoken: '', replace: '', enabled: true }, true);
      newRow.classList.add('highlight-pulse');
      const spokenInp = newRow.querySelector('.stt-cmd-spoken');
      if (spokenInp) spokenInp.focus();
      newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      updateCommandsCount();
      flashFeedback(msg('toastCommandAdded'), false);
    });

    cmdSearchInp.addEventListener('input', () => {
      const q = cmdSearchInp.value.toLowerCase().trim();
      const items = hudElements.commandsContainer.querySelectorAll('.stt-cmd-item');
      items.forEach((item) => {
        const sp = item.querySelector('.stt-cmd-spoken').value.toLowerCase();
        const rep = item.querySelector('.stt-cmd-replace').value.toLowerCase();
        item.style.display = (!q || sp.includes(q) || rep.includes(q)) ? 'flex' : 'none';
      });
    });

    msgSearchInp.addEventListener('input', () => {
      const q = msgSearchInp.value.toLowerCase().trim();
      const rows = hudElements.messagesContainer.querySelectorAll('.stt-msg-row');
      rows.forEach((r) => {
        const key = r.querySelector('.stt-msg-key').textContent.toLowerCase();
        const val = r.querySelector('.stt-msg-val').value.toLowerCase();
        r.style.display = (!q || key.includes(q) || val.includes(q)) ? 'flex' : 'none';
      });
    });

    hudElements.cfgShortcut.addEventListener('keydown', (e) => {
      e.preventDefault();
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Cmd');
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      hudElements.cfgShortcut.value = parts.join('+');
    });

    // Eventos dos Botões de Teste Rápido no Dicionário
    const testInp = shadow.querySelector('#stt-dict-test-input');
    const btnTestPular = shadow.querySelector('#stt-btn-test-pular');
    const btnTestParag = shadow.querySelector('#stt-btn-test-parag');
    const btnTestCursor = shadow.querySelector('#stt-btn-test-cursor');

    if (btnTestPular && testInp) {
      btnTestPular.addEventListener('click', () => {
        testInp.focus();
        state.targetElement = testInp;
        handleTranscribedChunk('pular linha');
      });
    }
    if (btnTestParag && testInp) {
      btnTestParag.addEventListener('click', () => {
        testInp.focus();
        state.targetElement = testInp;
        handleTranscribedChunk('novo parágrafo');
      });
    }
    if (btnTestCursor && testInp) {
      btnTestCursor.addEventListener('click', () => {
        testInp.focus();
        state.targetElement = testInp;
        handleTranscribedChunk('palavra trabalhando');
      });
    }

    makeDraggable(bar);
  }

  function openGhostDock() {
    state.isGhostOpen = true;
    if (hudElements.ghostStudio) {
      hudElements.ghostStudio.classList.add('open');
      updateTargetIndicator();
      if (hudElements.ghostInput) {
        hudElements.ghostInput.value = state.ghostText || '';
        hudElements.ghostInput.focus();
      }
    }
  }

  function closeGhostDock() {
    state.isGhostOpen = false;
    if (hudElements.ghostStudio) {
      hudElements.ghostStudio.classList.remove('open');
    }
  }

  function createSectionHeader(title) {
    const el = document.createElement('div');
    el.className = 'stt-section-title';
    el.textContent = title;
    return el;
  }

  function createSettingRow(title, desc, renderControl) {
    const row = document.createElement('div');
    row.className = 'stt-setting-row';
    const textGroup = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'stt-setting-label';
    label.textContent = title;
    const description = document.createElement('div');
    description.className = 'stt-setting-desc';
    description.textContent = desc;
    textGroup.appendChild(label);
    textGroup.appendChild(description);
    row.appendChild(textGroup);
    row.appendChild(renderControl());
    return row;
  }

  function createSwitchRow(title, desc, inputId, isChecked) {
    return createSettingRow(title, desc, () => {
      const label = document.createElement('label');
      label.className = 'stt-switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = inputId;
      input.checked = isChecked;
      const slider = document.createElement('span');
      slider.className = 'stt-slider';
      label.appendChild(input);
      label.appendChild(slider);
      return label;
    });
  }

  function updateHudState(status, message) {
    if (!hudElements.bar) return;
    if (status === 'listening') {
      hudElements.bar.classList.add('listening');
      hudElements.bar.classList.remove('error');
      hudElements.statusText.textContent = message || msg('statusListening');
    } else if (status === 'error') {
      hudElements.bar.classList.add('error');
      hudElements.bar.classList.remove('listening');
      hudElements.statusText.textContent = message || msg('statusError');
    } else {
      hudElements.bar.classList.remove('listening');
      hudElements.bar.classList.remove('error');
      hudElements.statusText.textContent = state.config.engine === 'whisper' ? msg('statusWhisperReady') : msg('statusReady');
    }
  }

  function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialRight, initialBottom;

    element.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialRight = window.innerWidth - rect.right;
      initialBottom = window.innerHeight - rect.bottom;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newRight = Math.max(10, Math.min(window.innerWidth - 60, initialRight - dx));
      const newBottom = Math.max(10, Math.min(window.innerHeight - 60, initialBottom - dy));
      if (hudElements.container) {
        hudElements.container.style.right = `${newRight}px`;
        hudElements.container.style.bottom = `${newBottom}px`;
      }
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (hudElements.container) {
        const rect = hudElements.container.getBoundingClientRect();
        state.config.hudPos = {
          right: Math.round(window.innerWidth - rect.right),
          bottom: Math.round(window.innerHeight - rect.bottom)
        };
        saveConfig(state.config);
      }
    }
  }

  function switchTab(tabId) {
    state.activeModalTab = tabId;
    if (!hudElements.modalBackdrop) return;
    const tabs = hudElements.modalBackdrop.querySelectorAll('.stt-tab-btn');
    const panes = hudElements.modalBackdrop.querySelectorAll('.stt-tab-pane');
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tabId));
    panes.forEach((p) => p.classList.toggle('active', p.dataset.tab === tabId));
  }

  function updateCommandsCount() {
    const counterEl = hudElements.modalBackdrop ? hudElements.modalBackdrop.querySelector('#stt-cmd-counter') : null;
    if (!counterEl || !hudElements.commandsContainer) return;
    const rows = hudElements.commandsContainer.querySelectorAll('.stt-cmd-item');
    let active = 0;
    rows.forEach((r) => {
      const chk = r.querySelector('.stt-cmd-enabled');
      if (chk && chk.checked) active++;
    });
    counterEl.textContent = msg('commandsCountTemplate', { count: rows.length, active });
  }

  function addOrActivatePunctuation(spoken, replace) {
    if (!hudElements.commandsContainer) return;
    const items = Array.from(hudElements.commandsContainer.querySelectorAll('.stt-cmd-item'));
    const found = items.find((it) => {
      const sp = it.querySelector('.stt-cmd-spoken');
      return sp && sp.value.trim().toLowerCase() === spoken.toLowerCase();
    });

    if (found) {
      const chk = found.querySelector('.stt-cmd-enabled');
      if (chk && !chk.checked) {
        chk.checked = true;
        chk.dispatchEvent(new Event('change'));
      }
      found.scrollIntoView({ behavior: 'smooth', block: 'center' });
      found.classList.remove('highlight-pulse');
      void found.offsetWidth;
      found.classList.add('highlight-pulse');
    } else {
      const newRow = renderCommandRow({ spoken, replace, enabled: true }, true);
      newRow.classList.add('highlight-pulse');
      newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      updateCommandsCount();
      flashFeedback(msg('toastCommandAdded'), false);
    }
  }

  // Insere tag do Dynamic Template (Text Blaze) no campo focado ou gera um novo comando
  function insertDynamicTemplateTag(tag) {
    if (state.lastFocusedCmdInput && document.contains(state.lastFocusedCmdInput)) {
      const inp = state.lastFocusedCmdInput;
      const start = inp.selectionStart !== null ? inp.selectionStart : inp.value.length;
      const end = inp.selectionEnd !== null ? inp.selectionEnd : inp.value.length;
      inp.value = inp.value.substring(0, start) + tag + inp.value.substring(end);
      inp.selectionStart = inp.selectionEnd = start + tag.length;
      inp.focus();
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      flashFeedback(msg('toastTemplateInserted'), false);
      playBeep(750, 40, 'triangle');
    } else {
      const newRow = renderCommandRow({ spoken: '', replace: tag, enabled: true }, true);
      newRow.classList.add('highlight-pulse');
      const spokenInp = newRow.querySelector('.stt-cmd-spoken');
      if (spokenInp) spokenInp.focus();
      newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      updateCommandsCount();
      flashFeedback(msg('toastTemplateInserted'), false);
      playBeep(750, 40, 'triangle');
    }
  }

  function renderCommandRow(cmd, prepend = false) {
    const row = document.createElement('div');
    row.className = 'stt-cmd-item' + (!cmd.enabled ? ' disabled' : '');

    // Switch individual compacto
    const switchLabel = document.createElement('label');
    switchLabel.className = 'stt-switch stt-switch-sm';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'stt-cmd-enabled';
    chk.checked = !!cmd.enabled;
    const slider = document.createElement('span');
    slider.className = 'stt-slider';
    switchLabel.appendChild(chk);
    switchLabel.appendChild(slider);

    // Badge visual de status
    const badge = document.createElement('span');
    badge.className = 'stt-cmd-status-badge ' + (cmd.enabled ? 'active' : 'inactive');
    badge.textContent = cmd.enabled ? msg('cmdActiveLabel') : msg('cmdInactiveLabel');

    chk.addEventListener('change', () => {
      badge.className = 'stt-cmd-status-badge ' + (chk.checked ? 'active' : 'inactive');
      badge.textContent = chk.checked ? msg('cmdActiveLabel') : msg('cmdInactiveLabel');
      row.classList.toggle('disabled', !chk.checked);
      updateCommandsCount();
    });

    const inpSpoken = document.createElement('input');
    inpSpoken.type = 'text';
    inpSpoken.className = 'stt-cmd-spoken';
    inpSpoken.placeholder = msg('cmdSpokenPlaceholder');
    inpSpoken.value = cmd.spoken || '';
    inpSpoken.addEventListener('focus', (e) => { state.lastFocusedCmdInput = e.target; });

    const arrow = document.createElement('span');
    arrow.className = 'stt-cmd-arrow';
    arrow.textContent = '➔';

    const inpReplace = document.createElement('input');
    inpReplace.type = 'text';
    inpReplace.className = 'stt-cmd-replace';
    inpReplace.placeholder = 'Substituir por';
    let displayReplace = cmd.replace || '';
    displayReplace = displayReplace.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    inpReplace.value = displayReplace;
    inpReplace.addEventListener('focus', (e) => { state.lastFocusedCmdInput = e.target; });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'stt-btn-del';
    btnDel.title = 'Excluir comando';
    btnDel.textContent = '✕';
    btnDel.addEventListener('click', () => {
      row.remove();
      updateCommandsCount();
    });

    row.appendChild(switchLabel);
    row.appendChild(badge);
    row.appendChild(inpSpoken);
    row.appendChild(arrow);
    row.appendChild(inpReplace);
    row.appendChild(btnDel);

    if (prepend && hudElements.commandsContainer) {
      hudElements.commandsContainer.prepend(row);
    } else if (hudElements.commandsContainer) {
      hudElements.commandsContainer.appendChild(row);
    }

    return row;
  }

  function openSettingsModal(targetTab = null) {
    try {
      if (hudElements.cfgEngine) hudElements.cfgEngine.value = state.config.engine || (isBrave ? 'whisper' : 'native');
      if (hudElements.cfgGroqKey) hudElements.cfgGroqKey.value = state.config.groqApiKey || '';
      if (hudElements.cfgShortcut) hudElements.cfgShortcut.value = state.config.shortcut || 'Alt+V';
      if (hudElements.cfgOutputMode) hudElements.cfgOutputMode.value = state.config.outputMode || 'ghost';
      if (hudElements.cfgAutoGhost) hudElements.cfgAutoGhost.checked = state.config.autoOpenGhostOnSpeech !== false;
      if (hudElements.cfgAiPunctuation) hudElements.cfgAiPunctuation.checked = !!state.config.aiPunctuation;
      if (hudElements.cfgPunctuation) hudElements.cfgPunctuation.checked = !!state.config.enablePunctuationCommands;
      if (hudElements.cfgCapitalize) hudElements.cfgCapitalize.checked = !!state.config.autoCapitalize;
      if (hudElements.cfgTrailingSpace) hudElements.cfgTrailingSpace.checked = state.config.addTrailingSpace !== false;
      if (hudElements.cfgSoundFx) hudElements.cfgSoundFx.checked = !!state.config.soundFx;
      if (hudElements.cfgVadPause) hudElements.cfgVadPause.value = String(state.config.vadSilencePauseMs || 1200);
      if (hudElements.cfgVadMax) hudElements.cfgVadMax.value = String(state.config.vadMaxSliceDurationMs || 12000);
      if (hudElements.cfgAutoRecover) hudElements.cfgAutoRecover.checked = state.config.autoRecoverAudio !== false;

      // Renderiza Mensagens Editáveis (NADA HARDCODED)
      renderMessagesConfig();

      // Renderiza Comandos de Voz e Pontuações Individuais
      hudElements.commandsContainer.innerHTML = '';
      (state.config.commands || []).forEach((cmd) => {
        renderCommandRow(cmd, false);
      });
      updateCommandsCount();

      // Ativa a aba solicitada
      switchTab(targetTab || state.activeModalTab || 'general');

      hudElements.modalBackdrop.classList.add('open');
    } catch (err) {
      console.error('[VoiceSTT] Falha ao abrir modal:', err);
    }
  }

  function renderMessagesConfig() {
    if (!hudElements.messagesContainer) return;
    hudElements.messagesContainer.innerHTML = '';

    const msgDescriptions = {
      statusReady: 'Status: Pronto (Nativo)',
      statusWhisperReady: 'Status: Pronto (Whisper)',
      statusListening: 'Status: Ouvindo',
      statusTranscribing: 'Status: Transcrevendo',
      statusError: 'Status: Erro Geral',
      statusMicBlocked: 'Status: Microfone Bloqueado',
      statusNetworkError: 'Status: Erro de Rede',
      ghostTitle: 'Ghost Studio: Título',
      ghostPlaceholder: 'Ghost Studio: Placeholder',
      btnInsert: 'Ghost Studio: Botão Inserir',
      btnCopy: 'Ghost Studio: Botão Copiar',
      btnClear: 'Ghost Studio: Botão Limpar',
      btnModeGhost: 'Ghost Studio: Botão Modo Ghost',
      btnModeDirect: 'Ghost Studio: Botão Modo Direto',
      feedbackCopied: 'Toast: Copiado',
      feedbackInserted: 'Toast: Inserido',
      noTargetSelected: 'Aviso: Sem Campo Selecionado',
      noTargetCopiedFallback: 'Aviso: Fallback para Área de Transferência',
      targetBadgePrefix: 'Prefixo do Indicador de Alvo',
      targetNoneBadge: 'Indicador: Nenhum Alvo',
      counterTemplate: 'Contador ({words} e {chars})',
      tooltipMic: 'Tooltip: Botão Microfone',
      tooltipGhost: 'Tooltip: Botão Ghost Studio',
      tooltipSettings: 'Tooltip: Botão Configurações',
      tooltipCloseGhost: 'Tooltip: Minimizar Ghost',
      modalTitle: 'Modal: Título Principal',
      tabGeneral: 'Aba: Geral & Motor',
      tabDictionary: 'Aba: Dicionário & Pontuações',
      tabMessages: 'Aba: Mensagens & Textos',
      tabGeneralTitle: 'Título da Aba Geral',
      tabDictionaryTitle: 'Título da Aba Dicionário',
      tabMessagesTitle: 'Título da Aba Mensagens',
      btnAddNewCommand: 'Botão: Adicionar Comando',
      searchCommandsPlaceholder: 'Placeholder: Busca de Comandos',
      searchMessagesPlaceholder: 'Placeholder: Busca de Mensagens',
      cmdActiveLabel: 'Badge: Comando Ativo',
      cmdInactiveLabel: 'Badge: Comando Inativo',
      quickChipsTitle: 'Título: Chips Rápidos de Pontuação',
      dynamicTemplatesTitle: 'Título: Dynamic Templates (Text Blaze)',
      commandsCountTemplate: 'Contador de Comandos ({count} e {active})',
      toastCommandAdded: 'Toast: Comando Adicionado',
      toastTemplateInserted: 'Toast: Tag de Template Inserida',
      btnSaveSettings: 'Modal: Botão Salvar',
      btnCancelSettings: 'Modal: Botão Cancelar',
      btnResetDefaults: 'Modal: Botão Restaurar Padrões'
    };

    const currentMsgs = state.config.messages || DEFAULT_CONFIG.messages;

    Object.keys(msgDescriptions).forEach((key) => {
      const row = document.createElement('div');
      row.className = 'stt-msg-row';

      const label = document.createElement('span');
      label.className = 'stt-msg-key';
      label.textContent = msgDescriptions[key] || key;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'stt-msg-val';
      input.dataset.msgKey = key;
      input.value = currentMsgs[key] !== undefined ? currentMsgs[key] : (DEFAULT_CONFIG.messages[key] || '');

      row.appendChild(label);
      row.appendChild(input);
      hudElements.messagesContainer.appendChild(row);
    });
  }

  function closeSettingsModal() {
    if (hudElements.modalBackdrop) {
      hudElements.modalBackdrop.classList.remove('open');
    }
  }

  function resetToDefaults() {
    if (!confirm('Deseja realmente restaurar todas as mensagens e configurações para os padrões originais?')) return;
    state.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    saveConfig(state.config);
    openSettingsModal(state.activeModalTab);
    applyConfigVisuals();
    flashFeedback(msg('feedbackReset'), false);
  }

  function saveModalSettings() {
    state.config.engine = hudElements.cfgEngine.value;
    state.config.groqApiKey = hudElements.cfgGroqKey.value.trim();
    state.config.shortcut = hudElements.cfgShortcut.value.trim() || 'Alt+V';
    state.config.outputMode = hudElements.cfgOutputMode.value;
    if (hudElements.cfgAutoGhost) state.config.autoOpenGhostOnSpeech = hudElements.cfgAutoGhost.checked;
    state.config.aiPunctuation = hudElements.cfgAiPunctuation.checked;
    state.config.enablePunctuationCommands = hudElements.cfgPunctuation.checked;
    state.config.autoCapitalize = hudElements.cfgCapitalize.checked;
    if (hudElements.cfgTrailingSpace) state.config.addTrailingSpace = hudElements.cfgTrailingSpace.checked;
    state.config.soundFx = hudElements.cfgSoundFx.checked;
    if (hudElements.cfgVadPause) state.config.vadSilencePauseMs = parseInt(hudElements.cfgVadPause.value, 10) || 1200;
    if (hudElements.cfgVadMax) state.config.vadMaxSliceDurationMs = parseInt(hudElements.cfgVadMax.value, 10) || 12000;
    if (hudElements.cfgAutoRecover) state.config.autoRecoverAudio = hudElements.cfgAutoRecover.checked;

    // Salva Mensagens Customizadas
    const newMessages = {};
    if (hudElements.messagesContainer) {
      hudElements.messagesContainer.querySelectorAll('.stt-msg-val').forEach((inp) => {
        const k = inp.dataset.msgKey;
        if (k) newMessages[k] = inp.value;
      });
    }
    state.config.messages = newMessages;

    // Salva Comandos e Pontuações com status individual
    const newCommands = [];
    const rows = hudElements.commandsContainer.querySelectorAll('.stt-cmd-item');
    rows.forEach((r) => {
      const enabled = r.querySelector('.stt-cmd-enabled').checked;
      const spoken = r.querySelector('.stt-cmd-spoken').value.trim();
      let replace = r.querySelector('.stt-cmd-replace').value;
      replace = replace.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

      if (spoken) {
        newCommands.push({ enabled, spoken, replace });
      }
    });
    state.config.commands = newCommands;

    saveConfig(state.config);
    applyConfigVisuals();
    closeSettingsModal();
    flashFeedback(msg('feedbackSaved'), false);
  }

  function applyConfigVisuals() {
    if (hudElements.shortcutBadge) hudElements.shortcutBadge.textContent = state.config.shortcut;
    if (hudElements.statusText) {
      hudElements.statusText.textContent = state.config.engine === 'whisper' ? msg('statusWhisperReady') : msg('statusReady');
    }
    if (hudElements.ghostTitleSpan) hudElements.ghostTitleSpan.textContent = msg('ghostTitle');
    if (hudElements.ghostInput) hudElements.ghostInput.placeholder = msg('ghostPlaceholder');
    if (hudElements.btnInsertGhost) hudElements.btnInsertGhost.textContent = msg('btnInsert');
    if (hudElements.btnCopyGhost) hudElements.btnCopyGhost.textContent = msg('btnCopy');
    if (hudElements.btnClearGhost) hudElements.btnClearGhost.textContent = msg('btnClear');
    if (hudElements.modalTitle) hudElements.modalTitle.textContent = msg('modalTitle');
    if (hudElements.btnSave) hudElements.btnSave.textContent = msg('btnSaveSettings');
    if (hudElements.btnCancel) hudElements.btnCancel.textContent = msg('btnCancelSettings');
    if (hudElements.btnReset) hudElements.btnReset.textContent = msg('btnResetDefaults');

    // Abas e Novos Controles
    const tabGeneralBtn = hudElements.modalBackdrop ? hudElements.modalBackdrop.querySelector('.stt-tab-btn[data-tab="general"]') : null;
    if (tabGeneralBtn) tabGeneralBtn.textContent = msg('tabGeneral');
    const tabDictBtn = hudElements.modalBackdrop ? hudElements.modalBackdrop.querySelector('.stt-tab-btn[data-tab="dictionary"]') : null;
    if (tabDictBtn) tabDictBtn.textContent = msg('tabDictionary');
    const tabMsgsBtn = hudElements.modalBackdrop ? hudElements.modalBackdrop.querySelector('.stt-tab-btn[data-tab="messages"]') : null;
    if (tabMsgsBtn) tabMsgsBtn.textContent = msg('tabMessages');

    const cmdSearchInp = hudElements.modalBackdrop ? hudElements.modalBackdrop.querySelector('#stt-cmd-search-input') : null;
    if (cmdSearchInp) cmdSearchInp.placeholder = msg('searchCommandsPlaceholder');
    const msgSearchInp = hudElements.modalBackdrop ? hudElements.modalBackdrop.querySelector('#stt-msg-search-input') : null;
    if (msgSearchInp) msgSearchInp.placeholder = msg('searchMessagesPlaceholder');

    updateModeButtonLabel();
    updateTargetIndicator();
    updateGhostCounters();
    updateCommandsCount();
  }

  // =========================================================================
  // 8. INICIALIZAÇÃO & PERSISTÊNCIA SPA
  // =========================================================================
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('🎙️ Alternar Ditado de Voz', () => toggleListening());
    GM_registerMenuCommand('📝 Abrir/Fechar Ghost Studio', () => {
      state.isGhostOpen ? closeGhostDock() : openGhostDock();
    });
    GM_registerMenuCommand('📖 Dicionário & Pontuações', () => openSettingsModal('dictionary'));
    GM_registerMenuCommand('⚙️ Configurações Gerais', () => openSettingsModal('general'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createHUD);
  } else {
    createHUD();
  }

  // Helper público para controle e testes interativos
  win.VoiceSTT = {
    openGhost: () => openGhostDock(),
    closeGhost: () => closeGhostDock(),
    toggleGhost: () => (state.isGhostOpen ? closeGhostDock() : openGhostDock()),
    openSettings: (tab = 'general') => openSettingsModal(tab),
    openDictionary: () => openSettingsModal('dictionary'),
    openMessages: () => openSettingsModal('messages'),
    toggleListening: () => toggleListening(),
    simulateSpeech: (text) => handleTranscribedChunk(text),
    getState: () => state,
    getConfig: () => state.config,
    resetConfig: () => resetToDefaults()
  };

  console.log(`[Echo] Ghost Studio v2.4.1 ativo. Modo: ${state.config.outputMode}`);
})();
