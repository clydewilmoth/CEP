'use client';

import { useState, useEffect } from 'react';

type FormProps = {
  id: string;
  onClose: () => void;
};

export default function StationForm({ id, onClose }: FormProps) {
  const [name, setName] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [status, setStatus] = useState('');

  const draftKey = `$StationDraft-${id}`;
  const savedKey = `$StationSaved-${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      const { name, beschreibung, status } = JSON.parse(saved);
      setName(name || '');
      setBeschreibung(beschreibung || '');
      setStatus(status || '');
    }
  }, [savedKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const value = e.target.value;

    if (field === 'name') setName(value);
    if (field === 'beschreibung') setBeschreibung(value);
    if (field === 'status') setStatus(value);

    const draft = { name, beschreibung, status };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  };

  const handleSave = () => {
    const savedData = { name, beschreibung, status };
    localStorage.setItem(savedKey, JSON.stringify(savedData));
    localStorage.removeItem(draftKey);
    console.log('Gespeichert:', savedData);
    onClose();
  };

  const handleCancel = () => {
    console.log('Abgebrochen.');
    onClose();
  };

  return (
    <div className="w-96 relative bg-white p-6 rounded-lg shadow-lg">
      <button onClick={handleCancel} className="absolute top-2 right-2 text-gray-600 hover:text-gray-900">X</button>
      <h2 className="text-2xl mb-4">Station bearbeiten (ID: {id})</h2>

      <input
        type="text"
        value={name}
        onChange={(e) => handleChange(e, 'name')}
        className="border p-2 w-full rounded mb-4"
        placeholder={`Station Name eingeben`}
      />
      <input
        type="text"
        value={beschreibung}
        onChange={(e) => handleChange(e, 'beschreibung')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Beschreibung eingeben"
      />
      <input
        type="text"
        value={status}
        onChange={(e) => handleChange(e, 'status')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Status eingeben"
      />

      <div className="flex justify-end gap-4 mt-4">
        <button onClick={handleCancel} className="px-4 py-2 border rounded">Abbrechen</button>
        <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">Speichern</button>
      </div>
    </div>
  );
}
