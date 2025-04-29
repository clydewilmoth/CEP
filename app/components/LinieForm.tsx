'use client';

import { useState, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';

type FormProps = {
  id: string;
  onClose: () => void;
};

export default function LinieForm({ id, onClose }: FormProps) {
  const [name, setName] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [status, setStatus] = useState('');

  const draftKey = `LinieDraft-${id}`;
  const savedKey = `LinieSaved-${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      const { name, beschreibung, status } = JSON.parse(saved);
      setName(name || '');
      setBeschreibung(beschreibung || '');
      setStatus(status || '');
    }
  }, [savedKey]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => {
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
      <h2 className="text-2xl mb-4">Linie {id} bearbeiten</h2>

      <input
        type="text"
        value={name}
        onChange={(e) => handleChange(e, 'name')}
        className="border p-2 w-full rounded mb-4"
        placeholder={`Linie Name eingeben`}
      />
      <Textarea
        value={beschreibung}
        onChange={(e) => handleChange(e as React.ChangeEvent<HTMLTextAreaElement>, 'beschreibung')}
        className="border p-2 w-full rounded mb-4"
        placeholder="Beschreibung eingeben"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="border p-2 w-full rounded cursor-pointer text-left">
            {status || "Bitte auswählen..."}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white w-full rounded shadow-lg p-2">
        <DropdownMenuItem onClick={() => setStatus("")} >
            reset
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleChange(
            { target: { value: "Backlog" } } as React.ChangeEvent<HTMLInputElement>, "status")} >
            Backlog
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleChange(
            { target: { value: "In progress" } } as React.ChangeEvent<HTMLInputElement>, "status")}>
            In progress
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleChange(
            { target: { value: "Done" } } as React.ChangeEvent<HTMLInputElement>, "status")}>
            Done
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex justify-end gap-4 mt-4">
        <button onClick={handleCancel} className="px-4 py-2 border rounded">Cancel</button>
        <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">save</button>
      </div>
    </div>
  );
}
