'use client';

import { Button } from '@/components/ui/button';
import { use, useState } from 'react';
import OperationForm from '@/app/components/OperationForm';

export default function ToolsPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = use(params); // Promise auflösen

  const operationen = [
    { id: "1", name: 'Operation 1' },
    { id: "2", name: 'Operation 2' },
    { id: "3", name: 'Operation 3' },
  ];

  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openForm = (id: string) => {
    setSelectedId(id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedId(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8">Operationen des Tools {toolId}</h1>
      <div className="flex flex-wrap gap-4">
        {operationen.map((operation) => (
          <div key={operation.id}>
            <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
              {operation.name}
              <Button
                className="p-4 absolute bottom-2 right-2"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  openForm(operation.id);
                }}
              >
                +
              </Button>
            </div>
            {showForm && selectedId === operation.id && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white p-8 rounded-lg shadow-lg relative">
                  <OperationForm id={operation.id} onClose={closeForm} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
