(async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const admin = await res.json();
  
      const bar = document.createElement('div');
      bar.style = 'display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:8px 16px;background:#f2f2f2;';
      bar.innerHTML = `<span>ສະບາຍດີ, ${admin.name}</span><button id="logoutBtn" style="cursor:pointer;padding:6px 12px;">ອອກຈາກລະບົບ</button>`;
      document.body.prepend(bar);
  
      document.getElementById('logoutBtn').onclick = async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/admin/login.html';
      };
    } catch {
      window.location.href = '/admin/login.html';
    }
  })();