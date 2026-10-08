import React, { useEffect, useRef, useState } from 'react';
import { getTableCount } from '../api.js';
import './table-prompt.css';

export default function TablePrompt({ onSubmit, onOnline }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [maxTable, setMaxTable] = useState(20);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    getTableCount()
      .then((d) => { if (d?.count) setMaxTable(d.count); })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');

    if (digits === '') {
      setValue('');
      setError('');
      return;
    }

    if (parseInt(digits, 10) > maxTable) {
      setError(`ເລກໂຕະຕ້ອງຢູ່ລະຫວ່າງ 1-${maxTable}`);
      return;
    }

    setValue(String(parseInt(digits, 10)));
    setError('');
  };

  const submit = () => {
    const n = parseInt(value, 10);
    if (!n || n < 1 || n > maxTable) {
      setError(`ເລກໂຕະຕ້ອງຢູ່ລະຫວ່າງ 1-${maxTable}`);
      return;
    }
    onSubmit(String(n));
  };

  return (
    <div className="tp-overlay">
      <div className="tp-box">
        <h3>ກະລຸນາປ້ອນເລກໂຕະ</h3>
        <p className="tp-sub">ຕ້ອງໃສ່ເລກໂຕະກ່ອນຈຶ່ງເບິ່ງເມນູໄດ້</p>

        <input
          ref={inputRef}
          className="tp-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={String(maxTable).length}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />

        {error && <div className="tp-error">⚠️ {error}</div>}

        <button className="tp-ok" onClick={submit}>ຢືນຢັນ</button>

        {onOnline && (
          <button className="tp-online" onClick={onOnline}>
            🛵 ສັ່ງອອນລາຍ (ແກັບ / ສົ່ງເຖິງບ້ານ)
          </button>
        )}
      </div>
    </div>
  );
}