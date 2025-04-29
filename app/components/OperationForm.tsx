'use client';

import { useState, useEffect } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';

type FormProps = {
  id: string;
  onClose: () => void;
};

export default function OperationForm({ id, onClose }: FormProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const [operationID, setOperationID] = useState<number | null>(null);
  const [toolID, setToolID] = useState<number | null>(null);
  const [operationShortName, setOperationShortName] = useState<string>('');
  const [operationDescription, setOperationDescription] = useState<string>('');
  const [operationDecisionCriteria, setOperationDecisionCriteria] = useState<string>('');
  const [operationSequenceGroup, setOperationSequenceGroup] = useState<string>('');
  const [alwaysPerform, setAlwaysPerform] = useState<boolean>(false);
  const [serialOrParallel, setSerialOrParallel] = useState<boolean>(false);
  const [ipAdressEKS_IP, setIpAdressEKS_IP] = useState<string>('');
  const [modifiedDate, setModifiedDate] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [lastUser, setLastUser] = useState<string>('');
  const [templateID, setTemplateID] = useState<number | null>(null);
  const [qGateRelevantID, setQGateRelevantID] = useState<number | null>(null);
  const [decisionClassID, setDecisionClassID] = useState<number | null>(null);
  const [savingClassID, setSavingClassID] = useState<number | null>(null);
  const [verificationClassID, setVerificationClassID] = useState<number | null>(null);
  const [generationClassID, setGenerationClassID] = useState<number | null>(null);

  const draftKey = `OperationDraft-${id}`;
  const savedKey = `OperationSaved-${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      const data = JSON.parse(saved);
      setOperationID(data.operationID || null);
      setToolID(data.toolID || null);
      setOperationShortName(data.operationShortName || '');
      setOperationDescription(data.operationDescription || '');
      setOperationDecisionCriteria(data.operationDecisionCriteria || '');
      setOperationSequenceGroup(data.operationSequenceGroup || '');
      setAlwaysPerform(data.alwaysPerform || false);
      setSerialOrParallel(data.serialOrParallel || false);
      setIpAdressEKS_IP(data.ipAdressEKS_IP || '');
      setModifiedDate(data.modifiedDate || '');
      setComment(data.comment || '');
      setLastUser(data.lastUser || '');
      setTemplateID(data.templateID || null);
      setQGateRelevantID(data.qGateRelevantID || null);
      setDecisionClassID(data.decisionClassID || null);
      setSavingClassID(data.savingClassID || null);
      setVerificationClassID(data.verificationClassID || null);
      setGenerationClassID(data.generationClassID || null);
    }
  }, [savedKey]);

  const handleSave = () => {
    const savedData = {
      operationID, toolID, operationShortName, operationDescription, operationDecisionCriteria,
      operationSequenceGroup, alwaysPerform, serialOrParallel, ipAdressEKS_IP, modifiedDate,
      comment, lastUser, templateID, qGateRelevantID, decisionClassID, savingClassID,
      verificationClassID, generationClassID,
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

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, 3));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  return (
    <div className="w-96 relative bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl mb-4">Operation {id} bearbeiten</h2>

      {/* Seite 1 */}
      {currentPage === 1 && (
        <>
          <input
            type="number"
            min={0}
            value={operationID !== null ? operationID.toString() : ''}
            onChange={(e) => setOperationID(Number(e.target.value))}
            className="border p-2 w-full rounded mb-4"
            placeholder="Operation ID eingeben"
          />
          <input
            type="number"
            min={0}
            value={toolID !== null ? toolID.toString() : ''}
            onChange={(e) => setToolID(Number(e.target.value))}
            className="border p-2 w-full rounded mb-4"
            placeholder="Tool ID eingeben"
          />
          <input
            type="text"
            value={operationShortName}
            onChange={(e) => setOperationShortName(e.target.value)}
            className="border p-2 w-full rounded mb-4"
            placeholder="Operation Kurzname eingeben"
          />
          <Textarea
            value={operationDescription}
            onChange={(e) => setOperationDescription(e.target.value)}
            className="border p-2 w-full rounded mb-4"
            placeholder="Beschreibung eingeben"
          />
          <Textarea
            value={operationDecisionCriteria}
            onChange={(e) => setOperationDecisionCriteria(e.target.value)}
            className="border p-2 w-full rounded mb-4"
            placeholder="Beschreibung eingeben"
          />
        </>
      )}

      {/* Seite 2 */}
      {currentPage === 2 && (
        <>
          <input
            type="text"
            value={operationSequenceGroup}
            onChange={(e) => setOperationSequenceGroup(e.target.value)}
            className="border p-2 w-full rounded mb-4"
            placeholder="Sequenzgruppe eingeben"
          />
          <input
            type="text"
            value={alwaysPerform ? 'true' : 'false'}
            onChange={(e) => setAlwaysPerform(e.target.value === 'true')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Immer ausführen (true/false)"
          />
          <input
            type="text"
            value={serialOrParallel ? 'true' : 'false'}
            onChange={(e) => setSerialOrParallel(e.target.value === 'true')}
            className="border p-2 w-full rounded mb-4"
            placeholder="Seriell oder Parallel (true/false)"
          />
          <input
            type="number"
            min={0}
            value={ipAdressEKS_IP}
            onChange={(e) => setIpAdressEKS_IP(e.target.value)}
            className="border p-2 w-full rounded mb-4"
            placeholder="IP Adresse EKS"
          />
          <input
            type="date"
            value={modifiedDate}
            onChange={(e) => setModifiedDate(e.target.value)}
            className="border p-2 w-full rounded mb-4"
            placeholder="Änderungsdatum"
          />
        </>
      )}

      {/* Seite 3 */}
      {currentPage === 3 && (
        <>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="border p-2 w-full rounded mb-4"
            placeholder="Beschreibung eingeben"
          />
          <input
            type="text"
            value={lastUser}
            onChange={(e) => setLastUser(e.target.value)}
            className="border p-2 w-full rounded mb-4"
            placeholder="Letzter Benutzer"
          />
          <input
            type="number"
            min={0}
            value={templateID !== null ? templateID.toString() : ''}
            onChange={(e) => setTemplateID(Number(e.target.value))}
            className="border p-2 w-full rounded mb-4"
            placeholder="Template ID"
          />
          <input
            type="number"
            min={0}
            value={qGateRelevantID !== null ? qGateRelevantID.toString() : ''}
            onChange={(e) => setQGateRelevantID(Number(e.target.value))}
            className="border p-2 w-full rounded mb-4"
            placeholder="Q-Gate Relevant ID"
          />
          <input
            type="number"
            min={0}
            value={decisionClassID !== null ? decisionClassID.toString() : ''}
            onChange={(e) => setDecisionClassID(Number(e.target.value))}
            className="border p-2 w-full rounded mb-4"
            placeholder="Entscheidungsklasse ID"
          />
        </>
      )}

      {/* Pagination */}
      <div className="flex justify-center mt-6">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={prevPage} 
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}/>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink onClick={() => setCurrentPage(1)} isActive={currentPage === 1}>1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink onClick={() => setCurrentPage(2)} isActive={currentPage === 2}>2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink onClick={() => setCurrentPage(3)} isActive={currentPage === 3}>3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={nextPage} 
                className={currentPage === 3 ? 'pointer-events-none opacity-50' : ''}/>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-4 mt-6">
        <button onClick={handleCancel} className="px-4 py-2 border rounded">cancel</button>
        <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">save</button>
      </div>
    </div>
  );
}