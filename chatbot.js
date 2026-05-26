/* ============================================================
   Horic Autos chatbot
   Trains itself from current inventory prices and running costs.
   ============================================================ */

const HoricAdvisor = (() => {
  let getInventory = () => [];
  let getIncome = () => 0;
  let setIncome = () => {};
  let getCosts = car => ({ fuel: 0, maintenance: 0, insurance: 0, total: 0 });
  let getFit = () => ({ className: 'neutral', label: 'Add income', message: '' });
  let priceText = amount => `GHS ${Number(amount || 0).toLocaleString()}`;

  function init(config = {}) {
    getInventory = config.getInventory || getInventory;
    getIncome = config.getIncome || getIncome;
    setIncome = config.setIncome || setIncome;
    getCosts = config.getCosts || getCosts;
    getFit = config.getFit || getFit;
    priceText = config.priceText || priceText;
    bindUi();
    seed();
  }

  function bindUi() {
    document.querySelectorAll('[data-open-chat]').forEach(button => {
      button.addEventListener('click', () => open());
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
    append('bot', 'Welcome. I am trained on the current Horic inventory, listing prices, and estimated running costs. Tell me your monthly income, cash budget, and how you drive.');
  }

  function toggle() {
    const panel = document.getElementById('chat-panel');
    if (panel?.classList.contains('open')) close();
    else open();
  }

  function open() {
    document.getElementById('chat-panel')?.classList.add('open');
    document.getElementById('chat-panel')?.setAttribute('aria-hidden', 'false');
    document.getElementById('chat-toggle')?.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.getElementById('chat-input')?.focus(), 50);
  }

  function close() {
    document.getElementById('chat-panel')?.classList.remove('open');
    document.getElementById('chat-panel')?.setAttribute('aria-hidden', 'true');
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
    append('user', prompt);
    const answer = buildResponse(prompt);
    setTimeout(() => append('bot', answer), 250);
  }

  function askAboutCar(car) {
    closeVehicleModalIfAvailable();
    submit(`Can I afford the ${car.year} ${car.make} ${car.model}? My monthly income is ${getIncome() ? `GHS ${getIncome()}` : 'not set yet'}.`);
  }

  function buildResponse(prompt) {
    const parsed = parseMoneyContext(prompt);
    const income = parsed.income || getIncome();
    if (parsed.income) setIncome(parsed.income);

    const knowledge = trainFromInventory();
    const lifestyle = inferLifestyle(prompt);
    const cars = recommendCars({ knowledge, income, budget: parsed.budget, lifestyle });

    if (!income && !parsed.budget) {
      return `I have ${knowledge.length} current listing${knowledge.length === 1 ? '' : 's'} loaded with prices and running costs. Share your monthly income or total cash budget in GHS so I can rank them properly.`;
    }

    if (!cars.length) {
      return `Based on ${income ? `GHS ${income.toLocaleString()} monthly income` : `a GHS ${parsed.budget.toLocaleString()} budget`}, the current stock is tight. I would avoid stretching into high maintenance cars and ask Horic to source a lower-cost option.`;
    }

    const top = cars.slice(0, 3).map(({ car, costs, fit }) => (
      `${car.year} ${car.make} ${car.model}: ${priceText(car.price)}, estimated GHS ${costs.total.toLocaleString()}/mo running cost (${fit.label.toLowerCase()}).`
    )).join('\n');

    const incomeLine = income
      ? `With GHS ${income.toLocaleString()} monthly income, your comfort ceiling is about GHS ${Math.round(income * 0.25).toLocaleString()}/mo for ownership costs.`
      : `With a GHS ${parsed.budget.toLocaleString()} cash budget, I focused on current listing price and estimated monthly running costs.`;

    return `${incomeLine}\n${top}\nMy first pick is the ${cars[0].car.make} ${cars[0].car.model} because it gives the best mix of price, practicality, and running-cost control from the current stock.`;
  }

  function trainFromInventory() {
    return getInventory().map(car => {
      const costs = getCosts(car);
      return {
        car,
        costs,
        price: Number(car.price || 0),
        totalMonthlyCost: Number(costs.total || 0),
        condition: car.condition || 'used',
        type: car.type || 'sedan',
        fuel: car.fuel || 'petrol'
      };
    });
  }

  function recommendCars({ knowledge, income, budget, lifestyle }) {
    return knowledge
      .filter(item => !budget || item.price <= budget)
      .filter(({ car }) => {
        if (lifestyle === 'family') return ['suv', 'sedan', 'van'].includes(car.type);
        if (lifestyle === 'work') return ['truck', 'suv', 'van'].includes(car.type);
        if (lifestyle === 'low-cost') return ['hybrid', 'electric', 'diesel'].includes(car.fuel) || car.price < 180000;
        return true;
      })
      .map(item => {
        const fit = getFit(item.car, item.costs, income);
        return { ...item, fit, score: scoreCar(item, fit, lifestyle) };
      })
      .sort((a, b) => a.score - b.score);
  }

  function scoreCar(item, fit, lifestyle) {
    let score = item.totalMonthlyCost + item.price / 600;
    if (fit.className === 'stretch') score += 1500;
    if (fit.className === 'risk') score += 5000;
    if (item.condition === 'used') score += 250;
    if (lifestyle === 'low-cost' && ['hybrid', 'electric', 'diesel'].includes(item.fuel)) score -= 500;
    if (lifestyle === 'family' && item.type === 'suv') score -= 400;
    return score;
  }

  function parseMoneyContext(text) {
    const normalized = text.toLowerCase().replace(/,/g, '');
    const numbers = [...normalized.matchAll(/(?:ghs|ghc|₵)?\s*(\d{4,9})/g)].map(match => Number(match[1]));
    const income = numbers.find(num => /income|earn|salary|monthly|month|per month/.test(normalized) && num < 100000);
    const budget = numbers.find(num => /budget|cash|have|price|afford/.test(normalized) && num >= 30000) || 0;
    return { income: income || 0, budget };
  }

  function inferLifestyle(text) {
    const lower = text.toLowerCase();
    if (/family|kids|school|suv|space|7.?seater/.test(lower)) return 'family';
    if (/work|site|farm|cargo|pickup|truck/.test(lower)) return 'work';
    if (/low|cheap|economy|fuel|daily|commute|maintenance/.test(lower)) return 'low-cost';
    return 'balanced';
  }

  function append(role, text) {
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

  function closeVehicleModalIfAvailable() {
    if (typeof closeVehicleModal === 'function') closeVehicleModal();
  }

  return { init, open, close, submit, askAboutCar, buildResponse, trainFromInventory };
})();

window.HoricAdvisor = HoricAdvisor;
