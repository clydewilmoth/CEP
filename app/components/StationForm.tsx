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
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';

type FormProps = {
  id: string;
  onClose: () => void;
};

export default function StationForm({ id, onClose }: FormProps) {
  const [page, setPage] = useState(1);

  const [stationID, setStationID] = useState<number | null>(null);
  const [stationNumber, setStationNumber] = useState<string>('');
  const [stationName, setStationName] = useState<string>('');
  const [stationTypeID, setStationTypeID] = useState<number | null>(null);
  const [modifiedDate, setModifiedDate] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [lastUser, setLastUser] = useState<string>('');
  const [configExplorerStatus, setConfigExplorerStatus] = useState<'ACTIVE' | 'INACTIVE' | 'PENDING' | ''>('');

  const draftKey = `$StationDraft-${id}`;
  const savedKey = `$StationSaved-${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      const data = JSON.parse(saved);
      setStationID(data.stationID ?? null);
      setStationNumber(data.stationNumber ?? '');
      setStationName(data.stationName ?? '');
      setStationTypeID(data.stationTypeID ?? null);
      setModifiedDate(data.modifiedDate ?? '');
      setComment(data.comment ?? '');
      setLastUser(data.lastUser ?? '');
      setConfigExplorerStatus(data.configExplorerStatus ?? '');
    }
  }, [savedKey]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => {
    const value = e.target.value;

    switch (field) {
      case 'stationID':
        setStationID(Number(value));
        break;
      case 'stationNumber':
        setStationNumber(value);
        break;
      case 'stationName':
        setStationName(value);
        break;
      case 'stationTypeID':
        setStationTypeID(Number(value));
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
      case 'configExplorerStatus':
        setConfigExplorerStatus(value as 'ACTIVE' | 'INACTIVE' | 'PENDING' | '');
        break;
      default:
        break;
    }

    const draft = {
      stationID,
      stationNumber,
      stationName,
      stationTypeID,
      modifiedDate,
      comment,
      lastUser,
      configExplorerStatus
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  };

  const handleSave = () => {
    const savedData = {
      stationID,
      stationNumber,
      stationName,
      stationTypeID,
      modifiedDate,
      comment,
      lastUser,
      configExplorerStatus
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
      <h2 className="text-2xl mb-4">Station {id} bearbeiten</h2>

      {page === 1 && (
        <>
          <input 
            type="number"
            min={0}
            value={stationID !== null ? stationID.toString() : ''}
            onChange={(e) => handleChange(e, 'stationID')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Station ID eingeben"  
          />
          <input
            type="number"
            min={0}
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
            type="number"
            min={0}
            value={stationTypeID !== null ? stationTypeID.toString() : ''}
            onChange={(e) => handleChange(e, 'stationTypeID')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Station Type ID eingeben"
          />
        </>
      )}

      {page === 2 && (
        <>
          <input
            type="date"
            value={modifiedDate}
            onChange={(e) => handleChange(e, 'modifiedDate')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Modified Date eingeben"
          />
          <Textarea
            value={comment}
            onChange={(e) => handleChange(e, 'comment')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Beschreibung eingeben"
          />
          <input
            type="text"
            value={lastUser}
            onChange={(e) => handleChange(e, 'lastUser')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Letzter Benutzer eingeben"
          />
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="border p-2 w-full rounded cursor-pointer text-left">
              {configExplorerStatus || "Bitte auswählen..."}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white w-full rounded shadow-lg p-2">
          <DropdownMenuItem onClick={() => setConfigExplorerStatus("")} >
              reset
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleChange(
              { target: { value: "ACTIVE" } } as React.ChangeEvent<HTMLInputElement>, "configExplorerStatus")} >
              ACTIVE
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleChange(
              { target: { value: "INACTIVE" } } as React.ChangeEvent<HTMLInputElement>, "configExplorerStatus")}>
              INACTIVE
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleChange(
              { target: { value: "PENDING" } } as React.ChangeEvent<HTMLInputElement>, "configExplorerStatus")}>
              PENDING
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <div className="flex justify-end mt-6">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={() => page > 1 && setPage(page - 1)}
                className={page === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            <PaginationItem>
              <PaginationLink
                href="#"
                isActive={page === 1}
                onClick={() => setPage(1)}
              >
                1
              </PaginationLink>
            </PaginationItem>

            <PaginationItem>
              <PaginationLink
                href="#"
                isActive={page === 2}
                onClick={() => setPage(2)}
              >
                2
              </PaginationLink>
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                href="#"
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
