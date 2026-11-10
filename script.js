// ====== НАСТРОЙКИ — меняйте под каждого клиента ======
const CONFIG = {
  phone: '+79990000000',          // телефон (только цифры и +)
  phoneText: '+7 (999) 000-00-00', // как телефон показывать на сайте
  telegram: 'username',           // ник в Telegram без @
  whatsapp: '79990000000',        // номер WhatsApp без +

  // Заявки в Telegram (необязательно). Как получить — см. README.md
  botToken: '',                   // токен бота от @BotFather
  chatId: '',                     // ваш chat_id
};

// Подставляем контакты
document.querySelectorAll('.js-phone').forEach(a => {
  a.href = 'tel:' + CONFIG.phone;
  a.textContent = CONFIG.phoneText;
});
document.querySelectorAll('.js-telegram').forEach(a => a.href = 'https://t.me/' + CONFIG.telegram);
document.querySelectorAll('.js-whatsapp').forEach(a => a.href = 'https://wa.me/' + CONFIG.whatsapp);
document.getElementById('year').textContent = new Date().getFullYear();

// Шапка темнеет при прокрутке
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll);
onScroll();

// Мобильное меню
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger.addEventListener('click', () => nav.classList.toggle('open'));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

// Плавное появление блоков при прокрутке
const revealItems = document.querySelectorAll('.feature, .price, .master, .review, .form');
revealItems.forEach(el => el.classList.add('reveal'));
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.15 });
revealItems.forEach(el => observer.observe(el));

// Отправка формы
const form = document.getElementById('form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const text = `Новая заявка с сайта!\nИмя: ${data.name}\nТелефон: ${data.phone}\nУслуга: ${data.service}`;

  if (CONFIG.botToken && CONFIG.chatId) {
    // Заявка прилетает владельцу в Telegram
    try {
      await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CONFIG.chatId, text }),
      });
    } catch (err) { console.error(err); }
  } else {
    // Бот не настроен — открываем WhatsApp с готовым сообщением
    window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), '_blank');
  }

  form.reset();
  document.getElementById('formSuccess').hidden = false;
});
