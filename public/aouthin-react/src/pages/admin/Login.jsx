import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api.js';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/admin');
    } catch (err) {
      setError(err.error || 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ');
    }
  }

  return (
    <div className="login-box">
      <h1>ເຂົ້າສູ່ລະບົບຮ້ານອາຫານ</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="ຊື່ຜູ້ໃຊ້" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="ລະຫັດຜ່ານ" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p style={{ color: 'red', fontSize: 13 }}>{error}</p>}
        <button type="submit">ເຂົ້າສູ່ລະບົບ</button>
      </form>
    </div>
  );
}
