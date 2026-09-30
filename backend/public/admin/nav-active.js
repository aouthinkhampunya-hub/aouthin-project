document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop();
  const navLinks = document.querySelectorAll("nav a");

  navLinks.forEach(link => {
    const linkPage = link.getAttribute("href");
    if (linkPage === currentPage) {
      link.classList.add("active");
    }
  });
});

// ===== ກອບແຖບເມນູ (nav) ໃຫ້ໜ້າຕາເໝືອນກັນທັງໃນຄອມ ແລະມືຖື =====
(function addNavBoxStyle() {
  const s = document.createElement('style');
  s.textContent = `
    header nav {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center;
      gap: 8px !important;
      background: #fbf3ea;
      border: 1px solid #f0e0cf;
      border-radius: 14px;
      padding: 10px !important;
      margin-top: 10px;
      box-sizing: border-box;
    }
    header nav a {
      flex: 1 1 140px;
      text-align: center;
      padding: 10px 14px;
      border-radius: 10px;
      background: #fff;
      color: #7a1f0f !important;
      font-weight: 700;
      font-size: 14px;
      text-decoration: none !important;
      border: 1px solid #f0e0cf;
      white-space: nowrap;
      box-sizing: border-box;
      transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    }
    header nav a:hover { background: #f7ece0; }
    header nav a.active {
      background: linear-gradient(135deg, #2f80ed, #1c64d1);
      color: #fff !important;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(47,128,237,0.35);
    }

    /* ປຸ່ມອື່ນທີ່ຖືກຍ້າຍເຂົ້າມາຢູ່ໃນ nav (ເຊັ່ນ 🔔 ເອີ້ນພະນັກງານ) ກວດເບິ່ງບໍ່ໃຫ້ຍືດຄືປຸ່ມເມນູ */
    header nav > *:not(a) {
      flex: 0 0 auto !important;
    }

    @media (max-width: 640px) {
      header nav a {
        flex: 1 1 45%;
        font-size: 13px;
        padding: 10px 8px;
      }
    }
  `;
  document.head.appendChild(s);
})();

// ===== ປຸ່ມ 🔔 ເອີ້ນພະນັກງານ (ຢູ່ໃນ nav ທຸກໜ້າແອັດມິນ, ບໍ່ແຕະຕົວແປ/ຟັງຊັນຂອງໄຟລ໌ອື່ນ) =====
(function () {
  let bellAudioCtx = null;
  let staffCallsOpen = false;
  let staffCallsData = [];
  let knownStaffCallIds = new Set();
  let staffFirstLoad = true;

  function playBellBeep() {
    try {
      if (!bellAudioCtx) {
        bellAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const now = bellAudioCtx.currentTime;
      [0, 0.18].forEach(offset => {
        const osc = bellAudioCtx.createOscillator();
        const gain = bellAudioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.9, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
        osc.connect(gain);
        gain.connect(bellAudioCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
    } catch (e) {}
  }
  document.addEventListener('click', () => {
    if (!bellAudioCtx) bellAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }, { once: true });

  (function addStaffBellStyle() {
    const s = document.createElement('style');
    s.textContent = `
      #global-staff-calls-bar { flex: 0 0 auto !important; margin-left: auto; display: inline-flex; align-items: center; }
      .staff-bell-btn {
        display: inline-flex; align-items: center; gap: 6px;
        width: fit-content !important; max-width: max-content; flex: 0 0 auto;
        margin: 0; background: #d9a520; border: none; color: #fff;
        font-weight: 700; font-size: 13px; line-height: 1.2; padding: 5px 12px;
        border-radius: 999px; cursor: pointer;
      }
      .staff-bell-btn .bell-icon { display: inline-block; transform-origin: 50% 10%; }
      .staff-bell-btn.ringing .bell-icon { animation: staffBellShake 1.4s ease-in-out infinite; }
      .staff-bell-btn .badge {
        background: #d32f2f; color: #fff; min-width: 18px; height: 18px;
        border-radius: 999px; display: inline-flex; align-items: center;
        justify-content: center; font-size: 12px; padding: 0 5px;
      }
      @keyframes staffBellShake {
        0%, 50%, 100% { transform: rotate(0); }
        10%, 30% { transform: rotate(-18deg); }
        20%, 40% { transform: rotate(18deg); }
      }
      .staff-modal-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        width: 100vw; height: 100vh; background: rgba(20, 12, 6, 0.75);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 20px; animation: staffFadeIn 0.2s ease;
      }
      .staff-modal-box {
        background: #fff; border-radius: 22px; width: 100%; max-width: 420px; max-height: 80vh;
        display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,0.45);
        animation: staffPopIn 0.25s ease; overflow: hidden;
      }
      .staff-modal-head { position: relative; text-align: center; padding: 26px 20px 14px; }
      .staff-modal-icon {
        width: 60px; height: 60px; margin: 0 auto 10px; border-radius: 50%; font-size: 28px;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(150deg, #FFC93C, #F2760C);
        box-shadow: 0 8px 20px rgba(242,118,12,0.35);
      }
      .staff-modal-head h3 { margin: 0; color: #2B1B0E; font-size: 18px; font-weight: 800; }
      .staff-modal-close {
        position: absolute; top: 12px; right: 14px; width: 32px; height: 32px;
        border: none; border-radius: 50%; background: #f3ece4; color: #7a1f10;
        font-size: 16px; font-weight: 700; cursor: pointer;
        display: flex; align-items: center; justify-content: center; padding: 0; margin: 0;
      }
      .staff-modal-close:hover { background: #e8dccf; }
      .staff-modal-list { padding: 6px 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
      .staff-modal-item {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        background: #fff3cd; border: 2px solid #d9a520; border-radius: 14px;
        padding: 12px 14px; color: #7a1f10; font-weight: 700;
      }
      .staff-modal-item button {
        background: #3C8031; color: #fff; border: none; border-radius: 10px;
        padding: 8px 14px; font-size: 14px; font-weight: 700; cursor: pointer;
        width: auto; margin: 0; flex: 0 0 auto;
      }
      .staff-modal-item button:hover { background: #2C601E; }
      @keyframes staffFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes staffPopIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
    document.head.appendChild(s);
  })();

  function ensureBar() {
    let bar = document.getElementById('global-staff-calls-bar');
    if (bar) return bar;
    const nav = document.querySelector('header nav') || document.querySelector('header');
    if (!nav) return null;
    bar = document.createElement('div');
    bar.id = 'global-staff-calls-bar';
    nav.appendChild(bar);
    return bar;
  }

  function renderStaffModal() {
    let overlay = document.getElementById('staff-call-modal');

    if (staffCallsData.length === 0) staffCallsOpen = false;
    if (!staffCallsOpen) {
      if (overlay) overlay.remove();
      return;
    }

    const key = staffCallsData.map(c => c.id).join(',');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'staff-call-modal';
      overlay.className = 'staff-modal-overlay';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) toggleStaffCalls();
      });
      document.body.appendChild(overlay);
    } else if (overlay.dataset.key === key) {
      return;
    }

    overlay.dataset.key = key;
    overlay.innerHTML = `
      <div class="staff-modal-box">
        <div class="staff-modal-head">
          <div class="staff-modal-icon">🔔</div>
          <h3>ລູກຄ້າເອີ້ນພະນັກງານ</h3>
          <button class="staff-modal-close" onclick="__globalStaffCalls.toggle()">✕</button>
        </div>
        <div class="staff-modal-list">
          ${staffCallsData.map(c => `
            <div class="staff-modal-item">
              <span>🔔 ໂຕະ ${c.table_number}</span>
              <button onclick="__globalStaffCalls.ack(${c.id})">ຮັບຮູ້ແລ້ວ</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function toggleStaffCalls() {
    staffCallsOpen = !staffCallsOpen;
    renderStaffModal();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && staffCallsOpen) toggleStaffCalls();
  });

  async function loadStaffCallsGlobal() {
    const bar = ensureBar();
    if (!bar) return;

    let calls;
    try {
      const res = await fetch('/api/staffcall');
      calls = await res.json();
    } catch (e) {
      return;
    }

    const currentIds = new Set(calls.map(c => c.id));
    if (!staffFirstLoad) {
      let hasNew = false;
      currentIds.forEach(id => { if (!knownStaffCallIds.has(id)) hasNew = true; });
      if (hasNew) playBellBeep();
    }
    knownStaffCallIds = currentIds;
    staffFirstLoad = false;

    staffCallsData = calls;

    if (calls.length === 0) {
      bar.innerHTML = '';
      renderStaffModal();
      return;
    }

    bar.innerHTML = `
      <button class="staff-bell-btn ringing" onclick="__globalStaffCalls.toggle()">
        <span class="bell-icon">🔔</span> <span>ເອີ້ນພະນັກງານ</span> <span class="badge">${calls.length}</span>
      </button>
    `;

    renderStaffModal();
  }

  async function ackStaffCallGlobal(id) {
    await fetch(`/api/staffcall/${id}/ack`, { method: 'PUT' });
    loadStaffCallsGlobal();
  }

  // ເປີດຊ່ອງທາງດຽວໃຫ້ inline onclick ໃນ HTML ທີ່ສ້າງຂ້າງເທິງເອີ້ນໄດ້ໂດຍບໍ່ໄປທັບຊື່ຟັງຊັນຂອງໜ້າອື່ນ
  window.__globalStaffCalls = { toggle: toggleStaffCalls, ack: ackStaffCallGlobal };

  function startPolling() {
    loadStaffCallsGlobal();
    setInterval(loadStaffCallsGlobal, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPolling);
  } else {
    startPolling();
  }
})();