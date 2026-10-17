# 🎙️ Echo — Real-Time Voice Transcription & Ghost Studio

> **Transforme sua voz em texto em tempo real em qualquer site.** Digite instantaneamente com microfone em campos `<input>`, `<textarea>` e editores ricos (`contenteditable`) como WhatsApp Web, ChatGPT, Discord, Notion, Gemini e Google Docs.

---

## ✨ Principais Funcionalidades

- **🚀 Live Loader Auto-Updater:** Instale uma vez no Tampermonkey e receba atualizações contínuas diretamente deste repositório no GitHub sem precisar reinstalar nada.
- **👻 Ghost Studio (Dock de Prévia & Edição):** Veja as palavras sendo transcritas em tempo real em um buffer flutuante translúcido. Edite se quiser antes de enviar para o campo ativo da página com um toque de `Enter`.
- **🛡️ Watchdog Anti-Travamento (Auto-Recuperador):** Monitor em segundo plano que descongela o `AudioContext` do navegador e restaura a captura do microfone automaticamente se a aba ficar inativa.
- **🎯 VAD Adaptativo Anti-Cortes:** Pausa de silêncio configurável (padrão 1200ms) para respeitar sua respiração natural e teto de fatia contínua de 12s para nunca cortar frases no meio.
- **⚡ Dynamic Templates (Estilo Text Blaze para Voz):** Comandos de voz com variáveis dinâmicas e fórmulas calculadas no momento da fala (`{saudacao}`, `{data}`, `{hora}`, `{data:iso}`, `{dia_semana}`, `{site}`, `{url}`, `{calc: expr}`, `{random: opt1 | opt2}`).
- **🌐 Dual Engine (Brave & Chrome):**
  - **Whisper AI (Groq Cloud):** Transcrição ultrarrápida, gratuita e de alta precisão baseada em Whisper Large v3 Turbo (essencial para navegadores baseados em Chromium como Brave).
  - **Google Web Speech Nativo:** Reconhecimento local e instantâneo sem necessidade de chave de API no Chrome e Edge.
- **🎛️ 100% Configurável (Nada Hardcoded):** Todos os rótulos, mensagens, toasts, atalhos e comandos de pontuação podem ser editados e salvos diretamente na interface.
- **🎨 Design Moderno Glassmorphism:** Equalizador dinâmico de 4 barras animadas, micro-feedback tátil com sintetizador Web Audio nativo e atalhos customizáveis.

---

## 📥 Como Instalar no Tampermonkey

### Opção 1: Via Live Loader (Recomendado — Auto-Atualizável) 🚀

Com o Live Loader, você instala uma única vez e o script busca e executa sempre a versão mais recente deste repositório:

1. Abra a extensão **Tampermonkey** no seu navegador.
2. Crie um novo script (`+`).
3. Cole o código de [`echo-loader.user.js`](https://raw.githubusercontent.com/MiiuGR4U/Echo/main/echo-loader.user.js).
4. Pressione `Ctrl + S` para salvar.

### Opção 2: Instalação Direta (Standalone)

Se preferir rodar o script completo diretamente no Tampermonkey sem sincronização remota:

1. Instale diretamente o arquivo [`voice-transcribe.user.js`](https://raw.githubusercontent.com/MiiuGR4U/Echo/main/voice-transcribe.user.js).
2. Salve no Tampermonkey (`Ctrl + S`).

---

## 🎯 Como Usar

1. **Posicione o cursor:** Clique em qualquer campo de texto ou editor na página.
2. **Ligue o microfone:**
   - Pressione o atalho global **`Alt + V`** (ou clique no botão flutuante do microfone no canto inferior direito).
   - O indicador mudará para **"Ouvindo..."** com a aura luminosa e as barras de onda sonora se movimentarão conforme sua voz.
3. **Fale naturalmente:**
   - No **Modo Ghost** (padrão), o dock se abre e renderiza o texto em tempo real para prévia e edição.
   - Pressione `Enter` para injetar o texto no campo ativo da página.
   - No **Modo Direto**, as palavras são digitadas diretamente na caixa de texto do site conforme você fala.
4. **Desligue:** Pressione `Alt + V` novamente para pausar.

---

## ⚡ Dynamic Templates (Text Blaze para Voz)

O Echo traz o poder dos snippets dinâmicos do Text Blaze para a fala. Basta falar o comando cadastrado no dicionário:

| Comando Falado | Template Cadastrado | Resultado em Tempo Real |
| :--- | :--- | :--- |
| *"saudação formal"* | `{saudacao}! Tudo bem?` | `Bom dia! Tudo bem?` *(ou Boa tarde / Boa noite)* |
| *"inserir data"* / *"data de hoje"* | `{data}` | `17/10/2026` |
| *"inserir hora"* | `{hora}` | `12:45` |
| *"link da página"* | `{url}` | `https://github.com/MiiuGR4U/Echo` |
| *"nome do site"* | `{site}` | `github.com` |
| *"inserir assinatura"* | `Atenciosamente,\ndj\n{saudacao}! {data}` | Assinatura completa formatada |

### Tags Dinâmicas Disponíveis:
- `{saudacao}`: Saudação automática baseada no horário atual.
- `{data}` / `{date}`: Data atual formatada (DD/MM/AAAA).
- `{data:iso}`: Data em formato padrão internacional (AAAA-MM-DD).
- `{data:+1d}` / `{data:+7d}` / `{data:-1d}`: Datas relativas (amanhã, semana que vem, ontem).
- `{hora}`: Hora atual (HH:MM).
- `{hora:segundos}`: Hora com precisão de segundos (HH:MM:SS).
- `{dia_semana}`: Nome por extenso do dia da semana (ex: `Segunda-feira`, `Sábado`).
- `{mes}` / `{ano}`: Nome do mês e ano corrente.
- `{site}` / `{url}` / `{titulo}`: Domínio, link completo e título da página atual.
- `{calc: expressao}`: Fórmulas matemáticas avaliadas dinamicamente (ex: `{calc: 10 * 5}` ➔ `50`).
- `{random: Opção A | Opção B}`: Escolha randômica entre itens separados por barra vertical.
- `{cursor}`: Posiciona o cursor do teclado no ponto indicado após a inserção.

---

## ⚙️ Painel de Configurações (Abas)

Clique no **ícone de engrenagem** na barra flutuante para abrir o menu:

### 1. ⚙️ Geral & Motor
- **Mecanismo:** Whisper AI (Groq Cloud) ou Google Web Speech (Nativo).
- **Chave API Groq:** Gratuita em [console.groq.com/keys](https://console.groq.com/keys) (indispensável no Brave).
- **Atalho Global:** Pressione qualquer combinação de teclas desejada (ex: `Alt+V`, `Ctrl+Shift+V`).
- **Modo de Saída:** Alternar entre Ghost Studio (prévia/edição) ou Injeção Direta.
- **Pausa de Fala do VAD:** 800ms a 2000ms de silêncio para corte natural de frases.
- **Duração Máxima da Frase:** 6s a 25s de teto contínuo para evitar cortes mid-sentence.
- **Watchdog Auto-Recuperador:** Chave liga/desliga para proteção contínua contra travamentos.

### 2. 📖 Dicionário & Pontuações
- Switches globais para comandos de pontuação falados, auto-capitalização e espaçamento.
- **Chips Rápidos de Pontuação:** Adicione símbolos com 1 clique (`vírgula`, `ponto final`, `interrogação`, `exclamação`, `pular linha`, etc.).
- **Chips de Dynamic Templates:** Insira variáveis dinâmicas com 1 clique no template focado.
- Tabela de comandos com toggle individual ativo/inativo, campo falado e valor de substituição.

### 3. 💬 Mensagens & Textos
- Personalização de 100% dos textos da interface: status, tooltips, botões, contadores e toasts.

---

## 🧪 Bancada de Testes

Para testar todos os motores, campos padrão e editores ricos (`contenteditable`), abra [`test-page.html`](./test-page.html) diretamente no seu navegador.

---

## 📄 Licença

Distribuído sob a licença MIT. Criado por [MiiuGR4U](https://github.com/MiiuGR4U).
