'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { use, useState } from 'react';
import StationForm from '@/app/components/StationForm';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Progress } from "@/components/ui/progress"
import { BookText } from 'lucide-react';

export default function LiniePage({ params }: { params: Promise<{ linieId: string }> }) {
  const { linieId } = use(params);

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
    <main className="min-h-screen flex flex-col items-center pt-15 p-8 bg-gray-50">
      <Progress value={33} className='w-60' />
      <h1 className="text-4xl font-bold mb-6 mt-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Linie {linieId}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </BreadcrumbList>
        </Breadcrumb>
      </h1>
      <div className="flex flex-wrap gap-4">
        {stationen.map((station) => (
          <div key={station.id}>
            <Link href={`/linie/${linieId}/station/${station.id}`}>
              <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
                {station.name}
                <Button
                  className="p-4 absolute right-2"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    openForm(station.id);
                  }}
                >
                  <BookText />
                </Button>
              </div>
            </Link>

            {showForm && selectedId === station.id && (
              <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 border-10">
                <StationForm id={station.id} onClose={closeForm} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
