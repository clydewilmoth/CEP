'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { use, useState } from 'react';
import Form from '@/app/components/LinieForm';
import StationForm from '@/app/components/StationForm';

export default function LiniePage({ params }: { params: Promise<{ linieId: string }> }) {
  const { linieId } = use(params); // ⬅️ use() auf das Promise aufrufen!

  const stationen = [
    { id: "1", name: 'Station 1' },
    { id: "2", name: 'Station 2' },
    { id: "3", name: 'Station 3' },
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
      <h1 className="text-4xl font-bold mb-8">Stationen der Linie {linieId}</h1>
      <div className="flex flex-wrap gap-4">
        {stationen.map((station) => (
          <div key={station.id}>
            <Link href={`/linie/${linieId}/station/${station.id}`}>
              <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
                {station.name}
                <Button
                  className="p-4 absolute bottom-2 right-2"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    openForm(station.id);
                  }}
                >
                  +
                </Button>
              </div>
            </Link>

            {showForm && selectedId === station.id && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white p-8 rounded-lg shadow-lg relative">
                  <StationForm id={station.id} onClose={closeForm} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
