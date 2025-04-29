'use client';

import { useState, useEffect } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type FormProps = {
  id: string;
  onClose: () => void;
};

export default function ToolsForm({ id, onClose }: FormProps) {
  const [page, setPage] = useState(1);

  const [toolID, setToolID] = useState<number | null>(null);
  const [stationID, setStationID] = useState<number | null>(null);
  const [toolShortName, setToolShortName] = useState<string>('');
  const [toolDescription, setToolDescription] = useState<string>('');
  const [ipAdressDevice, setIpAdressDevice] = useState<string>('');
  const [modifiedDate, setModifiedDate] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [lastUser, setLastUser] = useState<string>('');
  const [toolClassID, setToolClassID] = useState<number | null>(null);
  const [toolWithSPSID, setToolWithSPSID] = useState<number | null>(null);
  const [toolTypeID, setToolTypeID] = useState<number | null>(null);

  const draftKey = `ToolDraft-${id}`;
  const savedKey = `ToolSaved-${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      const data = JSON.parse(saved);
      setToolID(data.toolID ?? null);
      setStationID(data.stationID ?? null);
      setToolShortName(data.toolShortName ?? '');
      setToolDescription(data.toolDescription ?? '');
      setIpAdressDevice(data.ipAdressDevice ?? '');
      setModifiedDate(data.modifiedDate ?? '');
      setComment(data.comment ?? '');
      setLastUser(data.lastUser ?? '');
      setToolClassID(data.toolClassID ?? null);
      setToolWithSPSID(data.toolWithSPSID ?? null);
      setToolTypeID(data.toolTypeID ?? null);
    }
  }, [savedKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const value = e.target.value;

    switch (field) {
      case 'toolID':
        setToolID(Number(value));
        break;
      case 'stationID':
        setStationID(Number(value));
        break;
      case 'toolShortName':
        setToolShortName(value);
        break;
      case 'toolDescription':
        setToolDescription(value);
        break;
      case 'ipAdressDevice':
        setIpAdressDevice(value);
        break;
      case 'modifiedDate':
        setModifiedDate(value);
        break;
      case 'comment':
        setComment(value);
        break;
      case 'lastUser':
        setLastUser(value);
        break;
      case 'toolClassID':
        setToolClassID(Number(value));
        break;
      case 'toolWithSPSID':
        setToolWithSPSID(Number(value));
        break;
      case 'toolTypeID':
        setToolTypeID(Number(value));
        break;
      default:
        break;
    }

    const draft = {
      toolID, stationID, toolShortName, toolDescription, ipAdressDevice,
      modifiedDate, comment, lastUser, toolClassID, toolWithSPSID, toolTypeID
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  };

  const handleSave = () => {
    const savedData = {
      toolID, stationID, toolShortName, toolDescription, ipAdressDevice,
      modifiedDate, comment, lastUser, toolClassID, toolWithSPSID, toolTypeID
    };
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
      <h2 className="text-2xl mb-4">Tool bearbeiten (ID: {id})</h2>

      {page === 1 && (
        <>
          <input
            type="text"
            value={toolID !== null ? toolID.toString() : ''}
            onChange={(e) => handleChange(e, 'toolID')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Tool ID eingeben"
          />
          <input
            type="text"
            value={stationID !== null ? stationID.toString() : ''}
            onChange={(e) => handleChange(e, 'stationID')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Station ID eingeben"
          />
          <input
            type="text"
            value={toolShortName}
            onChange={(e) => handleChange(e, 'toolShortName')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Tool Kurzname eingeben"
          />
          <input
            type="text"
            value={toolDescription}
            onChange={(e) => handleChange(e, 'toolDescription')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Tool Beschreibung eingeben"
          />
          <input
            type="text"
            value={ipAdressDevice}
            onChange={(e) => handleChange(e, 'ipAdressDevice')}
            className="border p-2 w-full rounded mb-4"
            placeholder="IP Adresse eingeben"
          />
          <input
            type="text"
            value={modifiedDate}
            onChange={(e) => handleChange(e, 'modifiedDate')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Änderungsdatum eingeben"
          />
        </>
      )}

      {page === 2 && (
        <>
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
            value={toolClassID !== null ? toolClassID.toString() : ''}
            onChange={(e) => handleChange(e, 'toolClassID')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Tool Klasse ID eingeben"
          />
          <input
            type="text"
            value={toolWithSPSID !== null ? toolWithSPSID.toString() : ''}
            onChange={(e) => handleChange(e, 'toolWithSPSID')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Tool mit SPS ID eingeben"
          />
          <input
            type="text"
            value={toolTypeID !== null ? toolTypeID.toString() : ''}
            onChange={(e) => handleChange(e, 'toolTypeID')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Tool Typ ID eingeben"
          />
        </>
      )}

      <div className="flex justify-end mt-6">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => page > 1 && setPage(page - 1)}
                className={page === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            <PaginationItem>
              <PaginationLink
                isActive={page === 1}
                onClick={() => setPage(1)}
              >
                1
              </PaginationLink>
            </PaginationItem>

            <PaginationItem>
              <PaginationLink
                isActive={page === 2}
                onClick={() => setPage(2)}
              >
                2
              </PaginationLink>
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                onClick={() => page < 2 && setPage(page + 1)}
                className={page === 2 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
      <div className="flex justify-end gap-4 mt-6">
        <button onClick={handleCancel} className="px-4 py-2 border rounded">cancel</button>
        <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">save</button>
      </div>
    </div>
  );
}
