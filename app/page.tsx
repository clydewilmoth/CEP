'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import LinieForm from './components/LinieForm';
import { Progress } from "@/components/ui/progress"
import { BookText } from 'lucide-react';

export default function Home() {
  const linien = [
    { id: "1", name: 'Linie 1' },
    { id: "2", name: 'Linie 2' },
    { id: "3", name: 'Linie 3' },
    { id: "4", name: 'Linie 4' },
  ];

  const [showForm, setShowForm] = useState(false);
  const [selectedLinieId, setSelectedLinieId] = useState<string | null>(null);

  const openForm = (linieId: string) => {
    setSelectedLinieId(linieId);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedLinieId(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-8 bg-gray-50">
      <Progress value={0} className='w-60 mt-7' />
      <div className="flex flex-wrap gap-4 pt-13">
        {linien.map((linie) => (
          <div key={linie.id}>
            <Link href={`/linie/${linie.id}`}>
              <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
                {linie.name}
                <Button
                  className="p-4 absolute right-2"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault(); 
                    openForm(linie.id);
                  }}
                >
                  <BookText />
                </Button>
              </div>
            </Link>

            {showForm && selectedLinieId === linie.id && (
              <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 border-10">
                <LinieForm id={linie.id} onClose={closeForm} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
