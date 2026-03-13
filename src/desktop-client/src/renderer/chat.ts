const messagesEl = document.getElementById('messages') as HTMLDivElement | null;
const inputEl    = document.getElementById('input') as HTMLTextAreaElement | null;
const sendBtn    = document.getElementById('send-btn') as HTMLButtonElement | null;
const statusDot  = document.getElementById('status-dot') as HTMLSpanElement | null;
const statusLbl  = document.getElementById('status-label') as HTMLSpanElement | null;
const bootBar    = document.getElementById('boot-bar') as HTMLDivElement | null;

let isConnected  = false;
let isWaiting    = false;
let streamBubble: HTMLDivElement | null = null;

function appendSystem(text: string): void {
  if (!messagesEl) return;
  const row = document.createElement('div');
  row.className = 'msg-row system';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function scrollToBottom(): void {
  if (!messagesEl) return;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setConnected(val: boolean): void {
  isConnected = val;
  if (statusDot && statusLbl && bootBar) {
    if (val) {
      statusDot.className = 'online';
      statusLbl.textContent = '已连接';
      bootBar.classList.add('hidden');
    } else {
      statusDot.className = 'offline';
      statusLbl.textContent = '未连接';
    }
  }
  updateInputState();
}

function setProcPhase(
  phase: 'starting' | 'ready' | 'error' | 'stopped',
  message?: string,
): void {
  if (statusDot && statusLbl && bootBar) {
    if (phase === 'starting') {
      statusDot.className = 'starting';
      statusLbl.textContent = message || '正在启动…';
      bootBar.classList.remove('hidden');
    } else if (phase === 'ready') {
      statusDot.className = 'offline';
      statusLbl.textContent = '端口就绪，连接中…';
      bootBar.classList.add('hidden');
    } else if (phase === 'error') {
      statusDot.className = 'offline';
      statusLbl.textContent = '启动失败';
      bootBar.classList.add('hidden');
      appendSystem('❌ ' + (message || 'nanobot 启动失败，请检查环境'));
    } else if (phase === 'stopped') {
      statusDot.className = 'offline';
      statusLbl.textContent = '已停止';
    }
  }
}

function setWaiting(val: boolean): void {
  isWaiting = val;
  updateInputState();
}

function updateInputState(): void {
  if (!inputEl || !sendBtn) return;
  const enabled = isConnected && !isWaiting;
  inputEl.disabled = !enabled;
  sendBtn.disabled  = !enabled;
  if (enabled) inputEl.focus();
}

function appendMessage(
  role: 'user' | 'assistant',
  content: string,
  streaming = false,
): HTMLDivElement | null {
  if (!messagesEl) return null;
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '🧑' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (streaming ? ' streaming' : '');
  bubble.textContent = content;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
  return bubble;
}

type NanobotAPI = {
  send: (content: string, id?: string) => void;
  onMessage: (cb: (msg: any) => void) => () => void;
  onStatus: (cb: (status: { connected: boolean }) => void) => () => void;
  onProcStatus: (cb: (status: { phase: string; message?: string }) => void) => () => void;
};

type FeishuAPI = {
  openSetup: () => void;
};

const nanobotAPI: NanobotAPI | undefined = (window as any).nanobotAPI;
const feishuAPI: FeishuAPI | undefined = (window as any).feishuAPI;

if (!nanobotAPI) {
  appendSystem('⚠️ nanobot API 未就绪，请重启应用或检查 preload 配置');
} else {
  nanobotAPI.onProcStatus(({ phase, message }) => {
    setProcPhase(phase as any, message);
  });

  nanobotAPI.onStatus(({ connected }) => {
    setConnected(connected);
    if (connected) {
      appendSystem('✅ 已连接到 nanobot');
    } else {
      appendSystem('⚠️ 与 nanobot 断开连接，正在重连…');
      if (streamBubble) {
        streamBubble.classList.remove('streaming');
        streamBubble.textContent += ' [连接中断]';
        streamBubble = null;
        setWaiting(false);
      }
    }
  });

  nanobotAPI.onMessage((msg: any) => {
    if (msg.type === 'error') {
      if (streamBubble) {
        streamBubble.classList.remove('streaming');
        streamBubble = null;
      }
      appendSystem(msg.content || '发生未知错误');
      setWaiting(false);
      return;
    }

    if (msg.partial) {
      if (!streamBubble) {
        streamBubble = appendMessage('assistant', '', true);
      }
      if (streamBubble) {
        streamBubble.textContent += msg.content;
      }
      scrollToBottom();
    } else {
      if (streamBubble) {
        streamBubble.textContent = msg.content;
        streamBubble.classList.remove('streaming');
        streamBubble = null;
      } else {
        appendMessage('assistant', msg.content);
      }
      setWaiting(false);
    }
  });
}

function sendMessage(): void {
  if (!inputEl || !nanobotAPI) return;
  const text = inputEl.value.trim();
  if (!text || !isConnected || isWaiting) return;

  appendMessage('user', text);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  setWaiting(true);
  nanobotAPI.send(text);
}

if (sendBtn) {
  sendBtn.addEventListener('click', sendMessage);
}

if (inputEl) {
  inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  });
}

const feishuBtn = document.getElementById('btn-feishu-setup') as HTMLButtonElement | null;
if (feishuBtn && feishuAPI) {
  feishuBtn.addEventListener('click', () => {
    feishuAPI?.openSetup();
  });
}

