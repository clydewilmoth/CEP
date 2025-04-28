'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { use, useState } from 'react';
import ToolsForm from '@/app/components/ToolsForm';
export default function StationPage({ params }: { params: Promise<{ linieId: string, stationId: string }> }) {
  const { linieId, stationId } = use(params);

  const tools = [
    { id: "1", name: 'Tool 1' },
    { id: "2", name: 'Tool 2' },
    { id: "3", name: 'Tool 3' },
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
      <h1 className="text-4xl font-bold mb-8">cep - Tools der Station {stationId}</h1>
      <div className="flex flex-wrap gap-4">
        {tools.map((tool) => (
          <div key={tool.id}>
            <Link href={`/linie/${linieId}/station/${stationId}/tools/${tool.id}`}>
              <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
                {tool.name}
                <Button
                  className="p-4 absolute bottom-2 right-2"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    openForm(tool.id);
                  }}
                >
                  +
                </Button>
              </div>
            </Link>

            {showForm && selectedId === tool.id && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white p-8 rounded-lg shadow-lg relative">
                  <ToolsForm id={tool.id} onClose={closeForm} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
