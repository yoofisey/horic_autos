const HoricChatbot = (() => {
  let isOpen = false;
  let hasGreeted = false;
  let conversationHistory = [];

  const CAR_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 2h1m14-2l1 2h-1"/></svg>';

  function appendMessage(role, text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    const html = '<div class="chat-msg ' + role + '">' +
      '<div class="chat-msg-avatar ' + role + '"><div class="chat-msg-avatar-dot"></div></div>' +
      '<div class="chat-msg-bubble">' + formatted + '</div></div>';
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', '<div class="typing-indicator" id="typingIndicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>');
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    document.getElementById('typingIndicator')?.remove();
  }

  async function getReply(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });

    if (conversationHistory.length > 40) {
      conversationHistory = conversationHistory.slice(-30);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Server error');
      }

      const data = await res.json();
      const reply = data.reply || 'I could not generate a response. Please try again.';

      conversationHistory.push({ role: 'assistant', content: reply });
      return reply;
    } catch (err) {
      conversationHistory.pop();
      console.error('Chat error:', err);
      if (err.message === 'Failed to fetch') {
        return 'Could not reach the server. Make sure you are running **npm start** and opening **http://localhost:3000** (not the HTML file directly).';
      }
      return 'Something went wrong: ' + err.message + '. Please try again.';
    }
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    appendMessage('user', text);
    const input = document.getElementById('chatInput');
    if (input) input.value = '';

    const quickReplies = document.getElementById('quickReplies');
    if (quickReplies) quickReplies.style.display = 'none';

    showTyping();
    const reply = await getReply(text);
    hideTyping();
    appendMessage('bot', reply);
  }

  function toggleChat() {
    isOpen = !isOpen;
    const panel = document.getElementById('chatPanel');
    const toggle = document.querySelector('.chat-toggle');
    if (!panel) return;

    if (isOpen) {
      panel.classList.add('active');
      toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      if (!hasGreeted) {
        hasGreeted = true;
        appendMessage('bot', "Welcome to Horic Autos.\n\nI am your AI car advisor. I can help you find the perfect vehicle, estimate running costs, compare options, and more.\n\nWhat are you looking for today?");
      }
    } else {
      panel.classList.remove('active');
      toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
    }
  }

  function init() {
    const toggle = document.querySelector('.chat-toggle');
    if (toggle) toggle.addEventListener('click', toggleChat);

    const form = document.getElementById('chatForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        if (input) sendMessage(input.value);
      });
    }

    document.getElementById('quickReplies')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-reply');
      if (btn) sendMessage(btn.dataset.prompt);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { toggleChat, sendMessage };
})();

window.HoricAdvisor = { open: () => HoricChatbot.toggleChat(), close: () => HoricChatbot.toggleChat(), submit: (msg) => HoricChatbot.sendMessage(msg) };
