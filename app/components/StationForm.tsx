'use client';

import { useState, useEffect } from 'react';

type FormProps = {
  id: string;
  onClose: () => void;
};

export default function StationForm({ id, onClose }: FormProps) {
  const [stationID, setStationID] = useState<number | null>(null); // int → number
  const [stationNumber, setStationNumber] = useState<string>('');  // string
  const [stationName, setStationName] = useState<string>('');      // string
  const [stationTypeID, setStationTypeID] = useState<number | null>(null); // int → number
  const [modifiedDate, setModifiedDate] = useState<string>('');    // string (z.B. ISO-Datum)
  const [comment, setComment] = useState<string>('');              // string
  const [lastUser, setLastUser] = useState<string>('');            // string
  const [configExplorerStatus, setConfigExplorerStatus] = useState<'ACTIVE' | 'INACTIVE' | 'PENDING' | ''>('');

  const draftKey = `$StationDraft-${id}`;
  const savedKey = `$StationSaved-${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      const { stationID, stationNumber, stationName, stationTypeID, modifiedDate, 
        comment, lastUser, configExplorerStatus } = JSON.parse(saved); //erweitern
      setStationID(stationID || null);
      setStationNumber(stationNumber || '');
      setStationName(stationName || '');
      setStationTypeID(stationTypeID || null);
      setModifiedDate(modifiedDate || '');
      setComment(comment || '');
      setLastUser(lastUser || '');
      setConfigExplorerStatus(configExplorerStatus || '');
    }
  }, [savedKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const value = e.target.value;

    if (field === 'stationID') setStationID(Number(value));    // int → number
    if (field === 'stationNumber') setStationNumber(value);    // string
    if (field === 'stationName') setStationName(value);        // string
    if (field === 'stationTypeID') setStationTypeID(Number(value)); // int → number
    if (field === 'modifiedDate') setModifiedDate(value);      // string (z.B. ISO-Datum)
    if (field === 'comment') setComment(value);                // string
    if (field === 'lastUser') setLastUser(value);              // string
    if (field === 'configExplorerStatus') setConfigExplorerStatus(value as 'ACTIVE' | 'INACTIVE' | 'PENDING' | ''); // enum

    const draft = { stationID, stationNumber, stationName, stationTypeID, modifiedDate, 
      comment, lastUser, configExplorerStatus };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  };

  const handleSave = () => {
    const savedData = { stationID, stationNumber, stationName, stationTypeID, modifiedDate, 
      comment, lastUser, configExplorerStatus };
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
      <h2 className="text-2xl mb-4">Station {id} bearbeiten</h2>
      <input 
        type="text" 
        value={stationID !== null ? stationID.toString() : ''}
        onChange={(e) => handleChange(e, 'stationID')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Station ID eingeben"  
      />
      <input
        type="text"
        value={stationNumber}
        onChange={(e) => handleChange(e, 'stationNumber')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Station Number eingeben"
      />
      <input
        type="text"
        value={stationName}
        onChange={(e) => handleChange(e, 'stationName')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Station Name eingeben"
      />
      <input
        type="text"
        value={stationTypeID !== null ? stationTypeID.toString() : ''}
        onChange={(e) => handleChange(e, 'stationTypeID')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Station Type ID eingeben"
      />
      <input
        type="text"
        value={modifiedDate}
        onChange={(e) => handleChange(e, 'modifiedDate')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Modified Date eingeben"
      />
      <input
        type="text"
        value={comment}
        onChange={(e) => handleChange(e, 'comment')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Kommentar eingeben"
      />
      <input
        type="text"
        value={lastUser}
        onChange={(e) => handleChange(e, 'lastUser')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Letzter Benutzer eingeben"
      />
      <input
        type="text"
        value={configExplorerStatus}
        onChange={(e) => handleChange(e, 'configExplorerStatus')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Status eingeben (ACTIVE, INACTIVE, PENDING)"
      />
      <div className="flex justify-end gap-4 mt-4">
        <button onClick={handleCancel} className="px-4 py-2 border rounded">Abbrechen</button>
        <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">Speichern</button>
      </div>
    </div>
  );
}
