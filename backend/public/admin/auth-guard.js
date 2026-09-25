(async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const admin = await res.json();

    const bar = document.createElement('div');
    bar.style.cssText = `
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 16px;
      padding: 10px 24px;
      background: linear-gradient(to right, #8B0000, #a30000);
      color: white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      font-size: 14px;
    `;
    bar.innerHTML = `
      <span style="display:flex;align-items:center;gap:6px;">
        👋 ສະບາຍດີແອັດມິນ <strong>${admin.name}</strong>
      </span>
      <button id="logoutBtn" style="
        cursor: pointer;
        padding: 6px 16px;
        background: rgba(255,255,255,0.15);
        border: 1px solid rgba(255,255,255,0.4);
        border-radius: 6px;
        color: white;
        font-size: 13px;
        transition: background 0.2s;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
        ອອກຈາກລະບົບ
      </button>
    `;
    document.body.prepend(bar);

    document.getElementById('logoutBtn').onclick = async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/admin/login.html';
    };
  } catch {
    window.location.href = '/admin/login.html';
  }
})();