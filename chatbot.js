
const HoricAdvisor = (() => {
  function init() {
    bindUi();
    seed();
  }

  function bindUi() {
    document.querySelectorAll('[data-open-chat]').forEach(button => {
      button.addEventListener('click', open);
    });

    document.querySelector('[data-close-chat]')?.addEventListener('click', close);
    document.getElementById('chat-toggle')?.addEventListener('click', toggle);
    document.getElementById('chat-form')?.addEventListener('submit', handleSubmit);

    document.getElementById('quick-replies')?.addEventListener('click', event => {
      const button = event.target.closest('button[data-prompt]');
      if (!button) return;
      submit(button.dataset.prompt);
    });
  }

  function seed() {
    const messages = document.getElementById('chat-messages');
    if (!messages || messages.childElementCount) return;

    appendBot(
      "Welcome to Horic Autos. I’m your car advisor — ask me anything about buying, owning, or maintaining a car in Ghana."
    );
  }

  function toggle() {
    const panel = document.getElementById('chat-panel');
    panel?.classList.contains('open') ? close() : open();
  }

  function open() {
    const panel = document.getElementById('chat-panel');
    panel?.classList.add('open');
    panel?.setAttribute('aria-hidden', 'false');
    document.getElementById('chat-toggle')?.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.getElementById('chat-input')?.focus(), 50);
  }

  function close() {
    const panel = document.getElementById('chat-panel');
    panel?.classList.remove('open');
    panel?.setAttribute('aria-hidden', 'true');
    document.getElementById('chat-toggle')?.setAttribute('aria-expanded', 'false');
  }

  function handleSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const prompt = input?.value.trim();
    if (!prompt) return;
    input.value = '';
    submit(prompt);
  }

  function submit(prompt) {
    open();
    appendUser(prompt);
    showTyping();

    fetch("http://127.0.0.1:8080/api/ai/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: prompt })
})

      .then(res => res.json())
      .then(data => {
        hideTyping();
        appendBot(data.reply || "I couldn't process that. Try again.");
      })
      .catch(() => {
        hideTyping();
        appendBot("Network error. Please try again.");
      });
  }

  /* UI Rendering */

  function appendUser(text) {
    appendMessage("user", text);
  }

  function appendBot(text) {
    appendMessage("bot", text);
  }

  function appendMessage(role, text) {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;

    const row = document.createElement('div');
    row.className = `message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;

    row.append(bubble);
    messages.append(row);
    messages.scrollTop = messages.scrollHeight;
  }

  /* Typing Animation + Loading Dots */

  let typingRow = null;
  let typingInterval = null;

  function showTyping() {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;

    typingRow = document.createElement('div');
    typingRow.className = 'message bot typing';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble typing-bubble';
    bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;

    typingRow.append(bubble);
    messages.append(typingRow);
    messages.scrollTop = messages.scrollHeight;

    animateDots(bubble);
  }

  function hideTyping() {
    if (typingRow) typingRow.remove();
    typingRow = null;
    clearInterval(typingInterval);
  }

  function animateDots(bubble) {
    const dots = bubble.querySelectorAll('.dot');
    let index = 0;

    typingInterval = setInterval(() => {
      dots.forEach((dot, i) => {
        dot.style.opacity = i === index ? "1" : "0.3";
      });
      index = (index + 1) % dots.length;
    }, 350);
  }

  return { init, open, close, submit };
})();

window.HoricAdvisor = HoricAdvisor;
