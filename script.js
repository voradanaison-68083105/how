/* ==========================================================
   moonnie — script.js (shared by every page)
   Each init function runs only if its page's elements exist.

   Element ids used:
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable (its <tbody>)
   ========================================================== */

(function () {
  'use strict';

  var ORDER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwYeLS5ZDLIAcYAuY_fLe5t_IMTEkJo1bYSzkz4pcqAKw1sHpf-eaaIolt6t6f8f92J/exec';
  var ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSBG80anuHiFOx7IVe4a1yZ4CWWwr6Uv-3yQuH1At4CzkPOigsEVMJbBIwX-TZDdCTymhP24IH_2nOk/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  /* ---------- Helpers ---------- */

  // Create an element safely (text goes in as textContent, never HTML)
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(price) {
    return Number(price).toLocaleString('th-TH') + ' บาท';
  }

  function isValidMood(key) {
    return MOODS.some(function (m) { return m.key === key; });
  }

  /* ==========================================================
     1) product.html — product cards + mood filter
     ========================================================== */

  function initProducts() {
    var filterBar = document.getElementById('filter-bar');
    var list = document.getElementById('product-list');
    if (!filterBar || !list) return;

    list.classList.add('product-grid');

    var products = [];
    var currentMood = 'all';

    function buildFilterBar() {
      filterBar.innerHTML = '';
      filterBar.classList.add('filter-bar');

      MOODS.forEach(function (m) {
        var btn = el('button', 'btn filter-btn', m.label);
        btn.type = 'button';
        btn.dataset.mood = m.key;
        btn.addEventListener('click', function () {
          setMood(m.key, true);
        });
        filterBar.appendChild(btn);
      });
    }

    function updateButtons() {
      filterBar.querySelectorAll('.filter-btn').forEach(function (btn) {
        var active = btn.dataset.mood === currentMood;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function buildOrderLink(p) {
      var params = new URLSearchParams();
      params.set('item', p.name + ' ' + p.size);
      params.set('price', p.price);
      return 'order.html?' + params.toString();
    }

    function buildCard(p) {
      var card = el('article', 'product-card mood mood--' + p.mood);

      var imgWrap = el('div', 'product-card__image');
      var img = el('img');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      imgWrap.appendChild(img);

      var body = el('div', 'product-card__body');
      body.appendChild(el('h3', 'product-card__name', p.name));
      body.appendChild(el('span', 'mood-underline'));

      var meta = el('p', 'product-card__meta');
      meta.appendChild(el('span', 'mood-dot'));
      meta.appendChild(document.createTextNode(p.size));
      body.appendChild(meta);

      body.appendChild(el('p', 'product-card__price', formatPrice(p.price)));

      var buy = el('a', 'btn btn--gold', 'สั่งซื้อ');
      buy.href = buildOrderLink(p);
      body.appendChild(buy);

      card.appendChild(imgWrap);
      card.appendChild(body);
      return card;
    }

    function renderList() {
      list.innerHTML = '';

      var shown = products.filter(function (p) {
        return currentMood === 'all' || p.mood === currentMood;
      });

      if (shown.length === 0) {
        var empty = el('p', 'text-center', 'เร็วๆ นี้');
        empty.style.gridColumn = '1 / -1';
        list.appendChild(empty);
        return;
      }

      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function setMood(key, updateUrl) {
      currentMood = isValidMood(key) ? key : 'all';
      updateButtons();
      renderList();

      if (updateUrl && window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        if (currentMood === 'all') {
          url.searchParams.delete('mood');
        } else {
          url.searchParams.set('mood', currentMood);
        }
        window.history.replaceState(null, '', url);
      }
    }

    buildFilterBar();

    // Read ?mood=xxx before products arrive so the right button is highlighted
    var urlMood = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
    currentMood = isValidMood(urlMood) ? urlMood : 'all';
    updateButtons();

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        renderList();
      })
      .catch(function (error) {
        console.error(error);
        list.innerHTML = '';
        var msg = el('p', 'text-center', 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง');
        msg.style.gridColumn = '1 / -1';
        list.appendChild(msg);
      });
  }

  /* ==========================================================
     2) order.html — auto-fill form + submit to Apps Script
     ========================================================== */

  function initOrder() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    var itemsInput = document.getElementById('items');
    var totalInput = document.getElementById('total');

    // Fill from URL: order.html?item=...&price=...
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');

    if (itemsInput && item) itemsInput.value = item;
    if (totalInput && price) totalInput.value = price;

    function valueOf(id) {
      var node = document.getElementById(id);
      return node ? node.value.trim() : '';
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var payload = {
        customerName: valueOf('customerName'),
        contact: valueOf('contact'),
        items: valueOf('items'),
        total: valueOf('total'),
        note: valueOf('note')
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  /* ==========================================================
     3) admin.html — orders table from published Google Sheet CSV
     ========================================================== */

  // Minimal CSV parser: handles quoted fields, "" escapes,
  // commas and line breaks inside quotes, CRLF / LF.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }

    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function initAdmin() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    var COLS = 6; // date/time, name, contact, items, total, note

    function showMessage(text) {
      tbody.innerHTML = '';
      var tr = document.createElement('tr');
      var td = el('td', 'text-center', text);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage('กำลังโหลดข้อมูล...');

    fetch(ORDERS_CSV_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text)
          .slice(1) // first row = header
          .filter(function (r) {
            return r.some(function (cell) { return cell.trim() !== ''; });
          })
          .reverse(); // newest first (sheet rows are appended in time order)

        if (rows.length === 0) {
          showMessage('ยังไม่มีรายการสั่งซื้อ');
          return;
        }

        tbody.innerHTML = '';
        rows.forEach(function (r) {
          var tr = document.createElement('tr');
          for (var i = 0; i < COLS; i++) {
            tr.appendChild(el('td', '', (r[i] || '').trim()));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      });
  }

  /* ---------- Boot ---------- */

  function init() {
    initProducts();
    initOrder();
    initAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
