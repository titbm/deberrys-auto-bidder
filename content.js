// Auction Auto Bidder - Content Script
// Автоматические ставки на аукционе

class AutoBidder {
  constructor() {
    this.isRunning = false;
    this.currentBid = 1;
    this.balance = 0;
    this.button = null;
    this.statusBox = null;
    this.container = null;
    this.logEntries = [];
    this.statusLines = [];
    this.isReady = false;
    this.wasRunning = false; // Флаг для отслеживания состояния перед перезагрузкой
    
    this.init();
  }

  init() {
    this.createUI();
    this.log('Расширение инициализировано');
    this.updateStatus('⏳ Ожидание загрузки данных...');
    
    // Проверяем, было ли расширение запущено до перезагрузки
    const wasRunningBefore = sessionStorage.getItem('autoBidderWasRunning');
    if (wasRunningBefore === 'true') {
      sessionStorage.removeItem('autoBidderWasRunning');
      this.updateStatus('⚠️ Страница была обновлена, автоставки остановлены', 'error');
    }
    
    this.waitForPageReady();
  }

  log(message) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${hours}:${minutes}:${seconds}`;
    const entry = `[${timestamp}] ${message}`;
    this.logEntries.push(entry);
  }

  updateStatus(message, type = 'normal') {
    this.log(message);
    
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const time = `${hours}:${minutes}:${seconds}`;
    
    // Добавляем новую строку статуса
    this.statusLines.push({ message, type, time });
    
    // Оставляем только последние 5 строк
    if (this.statusLines.length > 5) {
      this.statusLines.shift();
    }
    
    // Обновляем UI
    this.renderStatus();
  }

  renderStatus() {
    if (!this.statusBox) return;
    
    this.statusBox.innerHTML = this.statusLines.map(line => {
      const className = line.type === 'success' ? 'highlight' : 
                       line.type === 'error' ? 'error' : '';
      // Экранируем HTML и заменяем длинные сообщения
      const message = line.message.length > 80 ? line.message.substring(0, 77) + '...' : line.message;
      return `<div class="status-line ${className}">[${line.time}] ${message}</div>`;
    }).join('');
    
    // Показываем статус, если есть строки
    if (this.statusLines.length > 0) {
      this.statusBox.classList.add('visible');
    }
  }

  createUI() {
    // Создаем контейнер с shadow DOM для полной изоляции
    const host = document.createElement('div');
    host.id = 'auto-bidder-host';
    host.style.cssText = 'all: initial; position: fixed !important; bottom: 20px !important; right: 20px !important; z-index: 2147483647 !important; pointer-events: none !important;';
    
    // Создаем shadow root
    const shadow = host.attachShadow({ mode: 'open' });
    
    // Добавляем стили в shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      * { pointer-events: auto !important; }
      .container {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }
      .status {
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1.6;
        max-width: 350px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        display: none;
      }
      .status.visible {
        display: block;
        animation: fadeIn 0.3s ease;
      }
      .status-line {
        margin: 4px 0;
        padding: 2px 0;
        opacity: 0.9;
        white-space: normal;
        word-wrap: break-word;
        overflow-wrap: break-word;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .status-line:last-child {
        border-bottom: none;
      }
      .status-line.highlight {
        color: #4ade80;
        font-weight: 600;
        opacity: 1;
      }
      .status-line.error {
        color: #f87171;
        font-weight: 600;
        opacity: 1;
      }
      .btn {
        padding: 12px 24px;
        font-size: 14px;
        font-weight: 600;
        background: #8b5cf6;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        transition: all 0.3s ease;
      }
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
        background: #7c3aed;
      }
      .btn:active {
        transform: translateY(0);
      }
      .btn.running {
        background: #ec4899;
        animation: pulse 2s ease-in-out infinite;
      }
      .btn.running:hover {
        background: #db2777;
        box-shadow: 0 6px 20px rgba(236, 72, 153, 0.6);
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: #6b7280;
      }
      .btn:disabled:hover {
        transform: none;
        box-shadow: 0 4px 15px rgba(107, 114, 128, 0.4);
        background: #6b7280;
      }
      @keyframes pulse {
        0%, 100% {
          box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4);
        }
        50% {
          box-shadow: 0 4px 25px rgba(236, 72, 153, 0.8);
        }
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    shadow.appendChild(style);
    
    // Создаем контейнер
    this.container = document.createElement('div');
    this.container.className = 'container';
    
    // Создаем блок статуса
    this.statusBox = document.createElement('div');
    this.statusBox.className = 'status';
    
    // Создаем кнопку управления
    this.button = document.createElement('button');
    this.button.id = 'auto-bidder-control';
    this.button.textContent = 'Загрузка...';
    this.button.className = 'btn';
    this.button.disabled = true;
    
    this.button.addEventListener('click', () => {
      if (!this.isReady) {
        return;
      }
      
      if (this.isRunning) {
        this.stop();
      } else {
        this.start();
      }
    });
    
    this.container.appendChild(this.statusBox);
    this.container.appendChild(this.button);
    shadow.appendChild(this.container);
    
    // Добавляем в body
    if (document.body) {
      document.body.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(host);
      });
    }
    
    this.log('UI создан');
  }

  async waitForPageReady() {
    // Сначала проверяем, не завершён ли аукцион
    const checkAuctionStatus = () => {
      // Ищем текст "Auction Complete"
      return Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent.trim() === 'Auction Complete'
      );
    };
    
    // Даём странице 2 секунды на загрузку перед проверкой статуса
    await this.sleep(2000);
    
    if (checkAuctionStatus()) {
      this.updateStatus('⚠️ Аукцион завершён', 'error');
      this.log('Аукцион завершён, скрываю расширение');
      
      // Показываем сообщение 5 секунд
      await this.sleep(5000);
      
      // Полностью скрываем UI
      const host = document.getElementById('auto-bidder-host');
      if (host) {
        host.style.display = 'none';
      }
      return;
    }
    
    const maxAttempts = 60; // 30 секунд максимум
    let attempts = 0;
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      // Проверяем баланс
      const balanceElement = document.querySelector('[data-sentry-component="BalanceDisplay"] span:first-child');
      const balanceText = balanceElement?.textContent?.trim();
      const hasBalance = balanceText && balanceText !== '?' && !isNaN(parseInt(balanceText));
      const balanceIsQuestionMark = balanceText === '?';
      
      // Проверяем текущую ставку - ищем span с классами text-2xl text-white font-medium рядом с Berry
      let hasCurrentBid = false;
      let currentBidValue = 0;
      let bidIsEncrypted = false;
      
      const bidElements = document.querySelectorAll('span.text-2xl.text-white.font-medium');
      for (const element of bidElements) {
        const text = element.textContent.trim();
        
        if (text.toLowerCase().includes('encrypted')) {
          bidIsEncrypted = true;
          continue;
        }
        
        const value = parseInt(text);
        
        if (!isNaN(value) && value >= 0) {
          const parent = element.closest('div');
          const hasBerrySymbol = parent && parent.querySelector('[data-sentry-component="Berry"]');
          
          if (hasBerrySymbol) {
            hasCurrentBid = true;
            currentBidValue = value;
            break;
          }
        }
      }
      
      // Если обнаружены невалидные данные - показываем ошибку и останавливаемся
      if (balanceIsQuestionMark || bidIsEncrypted) {
        clearInterval(checkInterval);
        
        let errorMsg = '❌ Невалидные данные: ';
        if (balanceIsQuestionMark) errorMsg += 'баланс показывает "?"';
        if (balanceIsQuestionMark && bidIsEncrypted) errorMsg += ', ';
        if (bidIsEncrypted) errorMsg += 'ставка показывает "Encrypted"';
        errorMsg += '. Обновите страницу.';
        
        this.updateStatus(errorMsg, 'error');
        this.log('Обнаружены невалидные данные, автоставки недоступны');
        this.button.textContent = 'Ошибка загрузки данных';
        return;
      }
      
      // Если оба значения получены
      if (hasBalance && hasCurrentBid) {
        clearInterval(checkInterval);
        this.balance = parseInt(balanceText);
        this.isReady = true;
        this.button.disabled = false;
        this.button.textContent = 'Запустить автоставки';
        this.updateStatus(`✅ Готово! Баланс: ${this.balance}, текущая ставка: ${currentBidValue}`, 'success');
        this.log(`Данные загружены: баланс ${this.balance}, текущая ставка ${currentBidValue}`);
        return;
      }
      
      // Обновляем статус
      if (!hasBalance && !hasCurrentBid) {
        this.updateStatus('⏳ Жду баланс и текущую ставку...');
      } else if (!hasBalance) {
        this.updateStatus('⏳ Жду баланс...');
      } else if (!hasCurrentBid) {
        this.updateStatus('⏳ Жду текущую ставку...');
      }
      
      // Таймаут
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        this.updateStatus('❌ Не удалось загрузить данные. Обновите страницу.', 'error');
        this.log('Таймаут загрузки данных');
        this.button.textContent = 'Таймаут загрузки';
      }
    }, 500);
  }

  updateBalance() {
    // Ищем блок с балансом
    const balanceElement = document.querySelector('[data-sentry-component="BalanceDisplay"] span:first-child');
    const balanceText = balanceElement?.textContent?.trim();
    
    if (balanceText === '?') {
      this.updateStatus('❌ Баланс не загружен (?)', 'error');
      return false;
    }
    
    if (balanceElement && balanceText && !isNaN(parseInt(balanceText))) {
      this.balance = parseInt(balanceText);
      this.updateStatus(`💰 Баланс: ${this.balance} монет`);
      return true;
    }
    
    this.updateStatus('❌ Не удалось найти баланс', 'error');
    return false;
  }

  getCurrentBid() {
    // Ищем блок с текущей ставкой - ищем span с большим текстом рядом с Berry символом
    const bidElements = document.querySelectorAll('span.text-2xl.text-white.font-medium');
    
    for (const element of bidElements) {
      const text = element.textContent.trim();
      
      if (text.toLowerCase().includes('encrypted')) {
        this.updateStatus('❌ Текущая ставка не загружена (Encrypted)', 'error');
        return null;
      }
      
      const value = parseInt(text);
      
      // Проверяем, что это число и рядом есть Berry символ
      if (!isNaN(value) && value >= 0) {
        const parent = element.closest('div');
        const hasBerrySymbol = parent && parent.querySelector('[data-sentry-component="Berry"]');
        
        if (hasBerrySymbol) {
          this.updateStatus(`📊 Текущая ставка: ${value}`);
          return value;
        }
      }
    }
    
    this.updateStatus('❌ Текущая ставка не найдена', 'error');
    return null;
  }

  async start() {
    if (!this.isReady) {
      return;
    }
    
    this.updateStatus('🚀 Запуск автоставок...');
    
    // Перепроверяем данные перед стартом
    if (!this.updateBalance()) {
      return;
    }

    // Получаем текущую ставку и начинаем со следующей
    const currentBid = this.getCurrentBid();
    if (currentBid === null) {
      return;
    }
    
    this.currentBid = currentBid + 1;

    this.isRunning = true;
    this.button.textContent = 'Остановить автоставки';
    this.button.classList.add('running');
    
    this.updateStatus(`▶️ Начинаем со ставки: ${this.currentBid}`, 'success');
    await this.bidLoop();
  }

  stop() {
    this.updateStatus('⏹️ Остановка автоставок...', 'error');
    this.isRunning = false;
    this.button.textContent = 'Запустить автоставки';
    this.button.classList.remove('running');
  }

  async bidLoop() {
    while (this.isRunning) {
      // Обновляем баланс перед каждой ставкой
      const balanceOk = this.updateBalance();
      
      // Проверяем текущую ставку
      const currentBid = this.getCurrentBid();
      
      // Если обнаружен "?" в балансе или "Encrypted" в ставке - останавливаемся
      if (!balanceOk || currentBid === null) {
        this.updateStatus('❌ Обнаружены невалидные данные. Остановка.', 'error');
        this.log('Обнаружен "?" или "Encrypted" во время работы');
        this.stop();
        return;
      }
      
      // Проверяем, хватает ли монет
      if (this.balance < this.currentBid) {
        this.updateStatus(`❌ Недостаточно монет (${this.balance}/${this.currentBid})`, 'error');
        this.stop();
        break;
      }

      this.updateStatus(`🎯 Делаю ставку: ${this.currentBid}`);
      
      const success = await this.placeBid(this.currentBid);
      
      if (success) {
        this.updateStatus(`✅ Ставка ${this.currentBid} размещена!`, 'success');
        this.currentBid++; // Увеличиваем ставку на следующую итерацию
        // Ждем 30 секунд перед следующей ставкой
        this.updateStatus('⏳ Жду 30 секунд перед следующей ставкой...');
        await this.sleep(30000);
      } else {
        this.updateStatus(`⚠️ Ошибка ставки ${this.currentBid}, повтор через 3 сек...`, 'error');
        // Пауза уже была в placeBid (3 сек показа ошибки), не добавляем еще
      }
    }
  }

  async placeBid(amount) {
    try {
      // Шаг 1: Открываем модальное окно
      this.updateStatus('📂 Открываю окно ставки...');
      const openButton = document.querySelector('button[data-sentry-source-file="place-a-bid.tsx"]');
      
      if (!openButton) {
        this.updateStatus('❌ Кнопка не найдена', 'error');
        return false;
      }
      
      openButton.click();
      await this.sleep(1000);

      // Шаг 2: Вводим ставку
      this.updateStatus(`⌨️ Ввожу ставку: ${amount}`);
      const input = document.querySelector('[role="dialog"] input[type="text"]');
      
      if (!input) {
        this.updateStatus('❌ Поле ввода не найдено', 'error');
        await this.closeModal();
        return false;
      }
      
      // Очищаем и вводим значение
      input.value = '';
      input.focus();
      input.value = amount.toString();
      
      // Триггерим события для React
      const inputEvent = new Event('input', { bubbles: true });
      const changeEvent = new Event('change', { bubbles: true });
      input.dispatchEvent(inputEvent);
      input.dispatchEvent(changeEvent);
      
      await this.sleep(500);

      // Шаг 3: Отправляем ставку
      this.updateStatus('📤 Отправляю ставку...');
      const submitButton = document.querySelector('[role="dialog"] button[type="submit"]');
      
      if (!submitButton) {
        this.updateStatus('❌ Кнопка отправки не найдена', 'error');
        await this.closeModal();
        return false;
      }
      
      if (submitButton.disabled) {
        this.updateStatus('❌ Кнопка неактивна', 'error');
        await this.closeModal();
        return false;
      }
      
      submitButton.click();
      
      // Шаг 4: Ждем результата (успех или ошибка)
      this.updateStatus('⏳ Жду результата...');
      const result = await this.waitForBidResult();
      
      if (result.success) {
        this.updateStatus('✅ Ставка принята!', 'success');
        await this.closeModal();
        return true;
      } else {
        this.updateStatus(`❌ ${result.error || 'Ошибка'}`, 'error');
        // Ждем 3 секунды перед закрытием окна, чтобы увидеть ошибку
        await this.sleep(3000);
        await this.closeModal();
        return false;
      }
      
    } catch (error) {
      this.updateStatus(`❌ Ошибка: ${error.message}`, 'error');
      await this.closeModal();
      return false;
    }
  }

  async waitForBidResult() {
    // Ждем появления сообщения об успехе или ошибке
    const maxWaitTime = 600000; // 10 минут максимум
    const checkInterval = 500; // проверяем каждые 500мс
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      // Проверяем успех
      const successMessage = Array.from(document.querySelectorAll('[role="dialog"] p')).find(p => 
        p.textContent.includes('successfully bid')
      );
      
      if (successMessage) {
        return { success: true };
      }
      
      // Сначала проверяем красный текст ошибки (самый точный индикатор)
      const redError = document.querySelector('[role="dialog"] .text-red-500');
      if (redError && redError.textContent.trim()) {
        return { success: false, error: redError.textContent.trim() };
      }
      
      // Если красной ошибки нет, ищем в других элементах
      const errorMessage = Array.from(document.querySelectorAll('[role="dialog"] p, [role="dialog"] div')).find(el => {
        const text = el.textContent.toLowerCase();
        // Проверяем только короткие элементы (чтобы не захватить весь диалог)
        if (text.length > 200) return false;
        
        return text.includes('no berries available') ||
               text.includes('relayer') ||
               text.includes('bad json') ||
               text.includes("didn't response") ||
               text.includes('error') || 
               text.includes('failed') || 
               text.includes('insufficient') ||
               text.includes('not enough') ||
               text.includes('try again');
      });
      
      if (errorMessage) {
        return { success: false, error: errorMessage.textContent.trim() };
      }
      
      // Проверяем, не закрылось ли модальное окно (может быть признаком ошибки)
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) {
        return { success: false, error: 'Модальное окно закрылось' };
      }
      
      await this.sleep(checkInterval);
    }
    
    // Таймаут
    return { success: false, error: 'Превышено время ожидания' };
  }

  async closeModal() {
    this.updateStatus('🚪 Закрываю окно...');
    
    // Пробуем ESC - самый надежный способ
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await this.sleep(500);
    
    // Проверяем, закрылось ли окно
    if (!document.querySelector('[role="dialog"]')) {
      return;
    }
    
    // Если ESC не сработал, ищем кнопку закрытия
    const closeButtons = document.querySelectorAll('[role="dialog"] button');
    
    for (const btn of closeButtons) {
      const hasImg = btn.querySelector('img');
      const text = btn.textContent.trim();
      
      // Ищем кнопку с иконкой без текста или с текстом закрытия
      if ((hasImg && text === '') || text.includes('×') || text.toLowerCase().includes('close')) {
        btn.click();
        await this.sleep(500);
        return;
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Zashapon Auto Player - Автоматическая игра на zashapon.com
class ZashaponAutoPlayer {
  constructor() {
    this.isRunning = false;
    this.button = null;
    this.statusBox = null;
    this.container = null;
    this.statusLines = [];
    this.failedAttemptsInRow = 0;
    this.maxFailedAttempts = 5;
    
    this.init();
  }

  init() {
    this.createUI();
    this.log('Zashapon Auto Player инициализирован');
    
    // Проверяем, было ли расширение запущено до перехода на другую страницу
    const wasRunning = sessionStorage.getItem('zashaponAutoPlayerRunning');
    if (wasRunning === 'true') {
      this.updateStatus('🔄 Продолжаю работу...', 'success');
      // Запускаем автоматически через небольшую задержку
      setTimeout(() => {
        this.start();
      }, 1000);
    } else {
      this.updateStatus('✅ Готов к запуску');
    }
  }

  log(message) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${hours}:${minutes}:${seconds}`;
    console.log(`[${timestamp}] ${message}`);
  }

  updateStatus(message, type = 'normal') {
    this.log(message);
    
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const time = `${hours}:${minutes}:${seconds}`;
    
    this.statusLines.push({ message, type, time });
    
    if (this.statusLines.length > 5) {
      this.statusLines.shift();
    }
    
    this.renderStatus();
  }

  renderStatus() {
    if (!this.statusBox) return;
    
    this.statusBox.innerHTML = this.statusLines.map(line => {
      const className = line.type === 'success' ? 'highlight' : 
                       line.type === 'error' ? 'error' : '';
      const message = line.message.length > 80 ? line.message.substring(0, 77) + '...' : line.message;
      return `<div class="status-line ${className}">[${line.time}] ${message}</div>`;
    }).join('');
    
    if (this.statusLines.length > 0) {
      this.statusBox.classList.add('visible');
    }
  }

  createUI() {
    const host = document.createElement('div');
    host.id = 'zashapon-player-host';
    host.style.cssText = 'all: initial; position: fixed !important; bottom: 20px !important; right: 20px !important; z-index: 2147483647 !important; pointer-events: none !important;';
    
    const shadow = host.attachShadow({ mode: 'open' });
    
    const style = document.createElement('style');
    style.textContent = `
      * { pointer-events: auto !important; }
      .container {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }
      .status {
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1.6;
        max-width: 350px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        display: none;
      }
      .status.visible {
        display: block;
        animation: fadeIn 0.3s ease;
      }
      .status-line {
        margin: 4px 0;
        padding: 2px 0;
        opacity: 0.9;
        white-space: normal;
        word-wrap: break-word;
        overflow-wrap: break-word;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .status-line:last-child {
        border-bottom: none;
      }
      .status-line.highlight {
        color: #4ade80;
        font-weight: 600;
        opacity: 1;
      }
      .status-line.error {
        color: #f87171;
        font-weight: 600;
        opacity: 1;
      }
      .btn {
        padding: 12px 24px;
        font-size: 14px;
        font-weight: 600;
        background: #8b5cf6;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        transition: all 0.3s ease;
      }
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
        background: #7c3aed;
      }
      .btn:active {
        transform: translateY(0);
      }
      .btn.running {
        background: #ec4899;
        animation: pulse 2s ease-in-out infinite;
      }
      .btn.running:hover {
        background: #db2777;
        box-shadow: 0 6px 20px rgba(236, 72, 153, 0.6);
      }
      @keyframes pulse {
        0%, 100% {
          box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4);
        }
        50% {
          box-shadow: 0 4px 25px rgba(236, 72, 153, 0.8);
        }
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    shadow.appendChild(style);
    
    this.container = document.createElement('div');
    this.container.className = 'container';
    
    this.statusBox = document.createElement('div');
    this.statusBox.className = 'status';
    
    this.button = document.createElement('button');
    this.button.textContent = 'Запустить';
    this.button.className = 'btn';
    
    this.button.addEventListener('click', () => {
      if (this.isRunning) {
        this.stop();
      } else {
        this.start();
      }
    });
    
    this.container.appendChild(this.statusBox);
    this.container.appendChild(this.button);
    shadow.appendChild(this.container);
    
    if (document.body) {
      document.body.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(host);
      });
    }
  }

  async start() {
    this.isRunning = true;
    this.failedAttemptsInRow = 0;
    this.button.textContent = 'Остановить';
    this.button.classList.add('running');
    this.updateStatus('🚀 Запуск автоигры...', 'success');
    
    // Сохраняем состояние в sessionStorage
    sessionStorage.setItem('zashaponAutoPlayerRunning', 'true');
    
    await this.mainLoop();
  }

  stop() {
    this.isRunning = false;
    this.button.textContent = 'Запустить';
    this.button.classList.remove('running');
    this.updateStatus('⏹️ Остановлено', 'error');
    
    // Удаляем состояние из sessionStorage
    sessionStorage.removeItem('zashaponAutoPlayerRunning');
  }

  async mainLoop() {
    while (this.isRunning) {
      // Проверяем, на какой странице мы находимся
      const currentUrl = window.location.href;
      
      if (currentUrl.includes('/collection?view=pods')) {
        // Мы на странице с капсулами
        await this.openPodsLoop();
      } else if (currentUrl.includes('zashapon.com')) {
        // Мы на главной странице
        const hasTickets = await this.playWithTickets();
        
        if (!hasTickets) {
          // Билеты закончились, переходим к капсулам
          this.updateStatus('🎫 Билеты закончились, проверяю капсулы...');
          await this.sleep(3000);
          window.location.href = 'https://zashapon.com/collection?view=pods';
          return; // Выходим, т.к. страница перезагрузится
        }
      }
      
      await this.sleep(1000);
    }
  }

  async playWithTickets() {
    // Проверяем количество билетов
    const ticketsCount = this.getTicketsCount();
    
    if (ticketsCount === 0) {
      this.updateStatus('❌ Билеты закончились');
      return false;
    }
    
    this.updateStatus(`🎫 Билетов: ${ticketsCount}`);
    await this.sleep(3000);
    
    // Нажимаем кнопку Play
    const playButton = this.findPlayButton();
    if (!playButton) {
      this.updateStatus('❌ Кнопка Play не найдена', 'error');
      await this.sleep(3000);
      return true;
    }
    
    this.updateStatus('🎮 Нажимаю Play...');
    playButton.click();
    
    // Ждем результата
    await this.sleep(3000);
    const result = await this.waitForGameResult();
    
    if (result === 'won') {
      this.updateStatus('🎉 Выиграли!', 'success');
      this.failedAttemptsInRow = 0;
      
      // Нажимаем Add to collection
      await this.sleep(3000);
      const addButton = this.findAddToCollectionButton();
      if (addButton) {
        this.updateStatus('➕ Добавляю в коллекцию...');
        addButton.click();
        await this.sleep(3000);
      }
    } else if (result === 'failed') {
      this.updateStatus('❌ Капсулу открыть не удалось', 'error');
      this.failedAttemptsInRow++;
      
      if (this.failedAttemptsInRow >= this.maxFailedAttempts) {
        this.updateStatus('⚠️ 5 неудач подряд! Смените IP-адрес!', 'error');
        this.stop();
        return false;
      }
      
      // Закрываем модальное окно
      await this.sleep(3000);
      await this.closeModal();
      await this.sleep(3000);
    }
    
    await this.sleep(3000);
    return true;
  }

  async openPodsLoop() {
    // Ищем кнопки Open
    const openButtons = this.findOpenButtons();
    
    if (openButtons.length === 0) {
      this.updateStatus('✅ Нет капсул для открытия', 'success');
      this.stop();
      return;
    }
    
    this.updateStatus(`📦 Найдено капсул: ${openButtons.length}`);
    await this.sleep(3000);
    
    // Нажимаем на первую кнопку
    const firstButton = openButtons[0];
    this.updateStatus('🔓 Открываю капсулу...');
    firstButton.click();
    
    // Ждем результата
    await this.sleep(3000);
    const result = await this.waitForGameResult();
    
    if (result === 'won') {
      this.updateStatus('🎉 Выиграли!', 'success');
      this.failedAttemptsInRow = 0;
      
      // Нажимаем Add to collection
      await this.sleep(3000);
      const addButton = this.findAddToCollectionButton();
      if (addButton) {
        this.updateStatus('➕ Добавляю в коллекцию...');
        addButton.click();
        await this.sleep(3000);
      }
    } else if (result === 'failed') {
      this.updateStatus('❌ Капсулу открыть не удалось', 'error');
      this.failedAttemptsInRow++;
      
      if (this.failedAttemptsInRow >= this.maxFailedAttempts) {
        this.updateStatus('⚠️ 5 неудач подряд! Смените IP-адрес!', 'error');
        this.stop();
        return;
      }
      
      // Закрываем модальное окно
      await this.sleep(3000);
      await this.closeModal();
    }
    
    await this.sleep(3000);
  }

  getTicketsCount() {
    const ticketLink = document.querySelector('a[aria-label="Ticket"]');
    if (!ticketLink) return 0;
    
    const countSpan = ticketLink.querySelector('span');
    if (!countSpan) return 0;
    
    const count = parseInt(countSpan.textContent.trim());
    return isNaN(count) ? 0 : count;
  }

  findPlayButton() {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent.trim();
      if (text === 'PLAY' && btn.classList.contains('animate-play-pulse')) {
        return btn;
      }
    }
    return null;
  }

  findAddToCollectionButton() {
    const buttons = document.querySelectorAll('button[type="button"]');
    for (const btn of buttons) {
      if (btn.textContent.trim() === 'Add to collection') {
        return btn;
      }
    }
    return null;
  }

  findOpenButtons() {
    const buttons = [];
    const allButtons = document.querySelectorAll('button');
    
    for (const btn of allButtons) {
      if (btn.textContent.trim() === 'Open' && 
          btn.classList.contains('from-primary-gradient')) {
        buttons.push(btn);
      }
    }
    
    return buttons;
  }

  async waitForGameResult() {
    const maxWaitTime = 30000; // 30 секунд
    const checkInterval = 500;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      // Проверяем на выигрыш
      const wonHeading = Array.from(document.querySelectorAll('h2')).find(h => 
        h.textContent.includes('WOW! YOU WON!!!')
      );
      
      if (wonHeading) {
        return 'won';
      }
      
      // Проверяем на неудачу
      const failedHeading = Array.from(document.querySelectorAll('h2')).find(h => 
        h.textContent.includes('Pod not fully opened')
      );
      
      if (failedHeading) {
        return 'failed';
      }
      
      await this.sleep(checkInterval);
    }
    
    return 'timeout';
  }

  async closeModal() {
    this.updateStatus('🚪 Закрываю окно (ESC)...');
    
    // Нажимаем ESC
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    
    // Ждем, пока диалог исчезнет
    const maxWaitTime = 5000; // 5 секунд максимум
    const checkInterval = 100;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      // Проверяем, что диалог исчез
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) {
        this.updateStatus('✅ Окно закрыто');
        return true;
      }
      
      await this.sleep(checkInterval);
    }
    
    this.updateStatus('⚠️ Таймаут закрытия окна', 'error');
    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Инициализация после полной загрузки страницы
function initAutoBidder() {
  const hostname = window.location.hostname;
  
  // Инициализируем AutoBidder только на deberrys.xyz
  if (hostname.includes('deberrys.xyz')) {
    const path = window.location.pathname;
    if (path === '/auctions' || path === '/auctions/') {
      return;
    }
    new AutoBidder();
  }
}

function initZashaponPlayer() {
  const hostname = window.location.hostname;
  
  // Инициализируем ZashaponAutoPlayer только на zashapon.com
  if (hostname.includes('zashapon.com')) {
    new ZashaponAutoPlayer();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initAutoBidder();
    initZashaponPlayer();
  });
} else if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initAutoBidder();
  initZashaponPlayer();
}
