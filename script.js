'use strict';

/* =====================================================
   تنظیمات پرچم‌ها
   فایل هر پرچم با الگوی  flags/<id>.svg  خوانده می‌شود.
   برای تعویض پرچم، فقط فایل هم‌نام را در پوشه flags
   جایگزین کنید (svg یا png). اگر پسوند را عوض کردید،
   FLAG_EXT را تغییر دهید.
   ===================================================== */
const FLAG_DIR = 'flags/';
const FLAG_EXT = '.svg';

/* فهرست کشورها — برای افزودن کشور جدید فقط یک مورد اضافه کنید */
const COUNTRIES = [
  { id: 'ir', name: 'ایران',   emoji: '🇮🇷' },
  { id: 'us', name: 'آمریکا',  emoji: '🇺🇸' },
  { id: 'ru', name: 'روسیه',   emoji: '🇷🇺' },
  { id: 'cn', name: 'چین',     emoji: '🇨🇳' },
  { id: 'de', name: 'آلمان',   emoji: '🇩🇪' },
  { id: 'fr', name: 'فرانسه',  emoji: '🇫🇷' },
  { id: 'gb', name: 'بریتانیا', emoji: '🇬🇧' },
  { id: 'jp', name: 'ژاپن',    emoji: '🇯🇵' },
  { id: 'tr', name: 'ترکیه',   emoji: '🇹🇷' },
  { id: 'in', name: 'هند',     emoji: '🇮🇳' }
];

/* وضعیت بازی — فقط در حافظه JavaScript نگهداری می‌شود */
const state = {
  selectedCountry: null, // کشور تأییدشده
  pendingCountry: null   // کشوری که در پنل تأیید است
};

/* ===== تلگرام ===== */
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

function initTelegram() {
  if (!tg) return;
  try { tg.ready(); } catch (e) { /* ignore */ }
  try { tg.expand(); } catch (e) { /* ignore */ }
  try { tg.setHeaderColor('#0e1a2b'); } catch (e) { /* نسخه‌های قدیمی */ }
  try { tg.setBackgroundColor('#0e1a2b'); } catch (e) { /* نسخه‌های قدیمی */ }
  try {
    // جلوگیری از بسته شدن ناخواسته برنامه هنگام اسکرول لیست
    if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
  } catch (e) { /* ignore */ }
}

function haptic(kind) {
  try {
    const h = tg && tg.HapticFeedback;
    if (!h) return;
    if (kind === 'success') h.notificationOccurred('success');
    else h.impactOccurred('light');
  } catch (e) { /* ignore */ }
}

/* ===== عناصر صفحه ===== */
const grid = document.getElementById('country-grid');
const modal = document.getElementById('confirm-modal');
const modalFlag = document.getElementById('confirm-flag');
const modalTitle = document.getElementById('confirm-title');
const btnYes = document.getElementById('confirm-yes');
const btnNo = document.getElementById('confirm-no');
const toast = document.getElementById('toast');

let lastFocused = null;
let toastTimer = null;

/* ===== پرچم ===== */
function createFlag(country) {
  const img = document.createElement('img');
  img.src = FLAG_DIR + country.id + FLAG_EXT;
  img.alt = 'پرچم ' + country.name;
  img.decoding = 'async';
  img.draggable = false;
  // اگر فایل پرچم پیدا نشد، ایموجی پرچم نمایش داده می‌شود
  img.addEventListener('error', function () {
    const fb = document.createElement('span');
    fb.className = 'flag-fallback';
    fb.textContent = country.emoji;
    fb.setAttribute('role', 'img');
    fb.setAttribute('aria-label', 'پرچم ' + country.name);
    if (img.parentNode) img.parentNode.replaceChild(fb, img);
  }, { once: true });
  return img;
}

/* ===== رندر کارت‌ها ===== */
function renderCountries() {
  const frag = document.createDocumentFragment();

  COUNTRIES.forEach(function (country) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = country.id;

    const flagBox = document.createElement('div');
    flagBox.className = 'flag';
    flagBox.appendChild(createFlag(country));

    const name = document.createElement('h2');
    name.className = 'country-name';
    name.textContent = country.name;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.dataset.action = 'select';
    btn.dataset.id = country.id;
    btn.textContent = 'انتخاب کشور';

    card.append(flagBox, name, btn);
    frag.appendChild(card);
  });

  grid.appendChild(frag);
}

/* به‌روزرسانی ظاهر کارت‌ها بعد از تأیید */
function updateSelectionUI() {
  const selectedId = state.selectedCountry ? state.selectedCountry.id : null;

  grid.querySelectorAll('.card').forEach(function (card) {
    const isSelected = card.dataset.id === selectedId;
    const btn = card.querySelector('button');

    card.classList.toggle('is-selected', isSelected);
    btn.classList.toggle('btn-primary', !isSelected);
    btn.classList.toggle('btn-chosen', isSelected);
    btn.textContent = isSelected ? 'کشور شما ✓' : 'انتخاب کشور';
    btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
}

/* ===== پنل تأیید ===== */
function openConfirm(country) {
  state.pendingCountry = country;
  lastFocused = document.activeElement;

  modalFlag.replaceChildren(createFlag(country));
  modalTitle.textContent = country.name;

  modal.hidden = false;
  void modal.offsetWidth; // اجرای انیمیشن ورود
  modal.classList.add('open');
  btnYes.focus({ preventScroll: true });
  haptic('light');
}

function closeConfirm() {
  state.pendingCountry = null;
  modal.classList.remove('open');

  setTimeout(function () {
    if (!modal.classList.contains('open')) modal.hidden = true;
  }, 240);

  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus({ preventScroll: true });
  }
}

function confirmSelection() {
  const country = state.pendingCountry;
  if (!country) return;

  state.selectedCountry = country;
  updateSelectionUI();
  closeConfirm();
  showToast('بازی با ' + country.name + ' شروع شد');
  haptic('success');
}

/* ===== پیام کوتاه ===== */
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  void toast.offsetWidth;
  toast.classList.add('show');

  toastTimer = setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () {
      if (!toast.classList.contains('show')) toast.hidden = true;
    }, 240);
  }, 2400);
}

/* ===== رویدادها ===== */
grid.addEventListener('click', function (event) {
  const btn = event.target.closest('button[data-action="select"]');
  if (!btn) return;

  const country = COUNTRIES.find(function (c) { return c.id === btn.dataset.id; });
  if (country) openConfirm(country);
});

btnYes.addEventListener('click', confirmSelection);
btnNo.addEventListener('click', closeConfirm);

modal.addEventListener('click', function (event) {
  if (event.target.hasAttribute('data-close')) closeConfirm();
});

document.addEventListener('keydown', function (event) {
  if (modal.hidden) return;

  if (event.key === 'Escape') {
    closeConfirm();
    return;
  }

  // نگه داشتن فوکوس داخل پنل
  if (event.key === 'Tab') {
    const first = btnYes;
    const last = btnNo;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

/* ===== شروع ===== */
initTelegram();
renderCountries();
