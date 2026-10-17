// ==UserScript==
// @name         Echo - Live Speech to Text (Auto Updater & Live Loader)
// @namespace    https://github.com/MiiuGR4U/Echo
// @version      2.4.0
// @description  Mantém o Echo (Ghost Studio - Speech to Text) atualizado automaticamente direto do GitHub sem precisar reinstalar nada no Tampermonkey.
// @author       MiiuGR4U
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @connect      api.groq.com
// @connect      api.openai.com
// @updateURL    https://raw.githubusercontent.com/MiiuGR4U/Echo/main/echo-loader.user.js
// @downloadURL  https://raw.githubusercontent.com/MiiuGR4U/Echo/main/echo-loader.user.js
// ==/UserScript==

(function () {
  'use strict';

  // URL direta do script payload no GitHub
  const REMOTE_URL = 'https://raw.githubusercontent.com/MiiuGR4U/Echo/main/voice-transcribe.user.js';
  const CACHE_KEY = 'ECHO_STT_CACHED_PAYLOAD';
  const CACHE_TIME_KEY = 'ECHO_STT_LAST_CHECK';

  console.log('[Echo Live Loader] Iniciando auto-updater v2.4.0...');

  function extractVersion(code) {
    if (!code || typeof code !== 'string') return '0.0';
    const match = code.match(/@version\s+([^\r\n]+)/);
    return match ? match[1].trim() : '0.0';
  }

  function getOverlayHost() {
    const fsEl = document.fullscreenElement ||
                 document.webkitFullscreenElement ||
                 document.mozFullScreenElement ||
                 document.msFullscreenElement;
    if (fsEl) {
      if (fsEl.tagName === 'VIDEO' && fsEl.parentElement) return fsEl.parentElement;
      return fsEl;
    }
    return document.body || document.documentElement;
  }

  function showLoaderNotification(message, icon = '🎙️', autoDismiss = 3500) {
    const render = () => {
      let toast = document.getElementById('echo-loader-toast');
      const container = getOverlayHost();
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'echo-loader-toast';
        toast.style.cssText = [
          'position: fixed !important',
          'top: 24px !important',
          'right: 24px !important',
          'z-index: 2147483647 !important',
          'background: rgba(11, 17, 32, 0.94) !important',
          'border: 1px solid #10b981 !important',
          'color: #ffffff !important',
          'padding: 12px 20px !important',
          'border-radius: 12px !important',
          'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
          'font-size: 13px !important',
          'font-weight: 600 !important',
          'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 16px rgba(16, 185, 129, 0.35) !important',
          'display: flex !important',
          'align-items: center !important',
          'gap: 10px !important',
          'backdrop-filter: blur(14px) !important',
          '-webkit-backdrop-filter: blur(14px) !important',
          'transition: opacity 0.3s ease, transform 0.3s ease !important',
          'transform: translateY(-8px) !important',
          'opacity: 0 !important',
          'pointer-events: none !important'
        ].join(';');
        if (container) container.appendChild(toast);
        requestAnimationFrame(() => {
          toast.style.transform = 'translateY(0)';
          toast.style.opacity = '1';
        });
      } else if (toast.parentNode !== container && container) {
        container.appendChild(toast);
      }
      toast.innerHTML = `<span style="font-size: 16px;">${icon}</span> <span>${message}</span>`;
      if (autoDismiss > 0) {
        setTimeout(() => {
          if (toast && toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
            setTimeout(() => toast.remove(), 350);
          }
        }, autoDismiss);
      }
    };
    if (document.body || document.documentElement) render();
    else window.addEventListener('DOMContentLoaded', render);
  }

  // 1. Execução Instantânea (Zero Delay / Cache-First)
  const cachedScript = GM_getValue(CACHE_KEY, null);
  if (cachedScript && typeof cachedScript === 'string' && cachedScript.trim().length > 100) {
    try {
      eval(cachedScript);
      console.log('[Echo Live Loader] Código em cache v' + extractVersion(cachedScript) + ' carregado instantaneamente.');
    } catch (err) {
      console.error('[Echo Live Loader] Erro ao executar script em cache:', err);
    }
  } else {
    showLoaderNotification('Baixando Echo v2.3.0 do GitHub...', '⏳', 0);
  }

  // 2. Sincronização Remota em Segundo Plano
  function syncRemoteCode(isFirstRun = false, forceReload = false) {
    const bustUrl = REMOTE_URL + '?t=' + Date.now() + '&r=' + Math.random().toString(36).substring(7);

    GM_xmlhttpRequest({
      method: 'GET',
      url: bustUrl,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache'
      },
      onload: function (res) {
        if (res.status === 200 && res.responseText && res.responseText.length > 500) {
          const latestCode = res.responseText;
          const oldVer = extractVersion(cachedScript);
          const newVer = extractVersion(latestCode);

          if (latestCode !== cachedScript) {
            GM_setValue(CACHE_KEY, latestCode);
            GM_setValue(CACHE_TIME_KEY, Date.now());
            console.log(`[Echo Live Loader] ✨ Nova versão ${newVer} baixada e armazenada!`);

            if (isFirstRun) {
              try {
                eval(latestCode);
                showLoaderNotification(`Echo v${newVer} instalado com sucesso!`, '🎉');
              } catch (err) {
                console.error('[Echo Live Loader] Erro ao executar código baixado:', err);
              }
            } else {
              showLoaderNotification(`Echo atualizado (v${oldVer} ➔ v${newVer})! Atualizando tela em 1.5s...`, '🚀', 2500);
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            }
          } else {
            console.log(`[Echo Live Loader] Script já está na versão mais recente (v${newVer}).`);
            if (forceReload) {
              showLoaderNotification(`Echo já está atualizado (v${newVer})!`, '✅');
            }
          }
        } else {
          console.warn('[Echo Live Loader] Resposta inesperada do GitHub:', res.status);
          if (forceReload) {
            showLoaderNotification('Falha ao conectar com o GitHub.', '❌');
          }
        }
      },
      onerror: function (err) {
        console.warn('[Echo Live Loader] Erro de rede ao buscar atualização:', err);
        if (forceReload) {
          showLoaderNotification('Erro de rede ao buscar atualização.', '❌');
        }
      }
    });
  }

  // Se não havia cache, executa na hora e aguarda
  if (!cachedScript) {
    syncRemoteCode(true, false);
  } else {
    // Sincroniza em segundo plano com micro-delay para não impactar o carregamento da página
    setTimeout(() => {
      syncRemoteCode(false, false);
    }, 1200);
  }

  // 3. Comandos do Menu Tampermonkey
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('🔄 Forçar Atualização do Echo (GitHub)', () => {
      showLoaderNotification('Verificando atualizações no GitHub...', '🔍', 2000);
      syncRemoteCode(false, true);
    });

    GM_registerMenuCommand('🧹 Limpar Cache do Loader', () => {
      GM_setValue(CACHE_KEY, '');
      GM_setValue(CACHE_TIME_KEY, 0);
      showLoaderNotification('Cache do Echo limpo! Recarregando página...', '🧹', 2000);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    });

    GM_registerMenuCommand('📦 Abrir Repositório no GitHub (Echo)', () => {
      window.open('https://github.com/MiiuGR4U/Echo', '_blank');
    });
  }
})();
