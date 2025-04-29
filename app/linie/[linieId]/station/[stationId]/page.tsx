'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { use, useState } from 'react';
import ToolsForm from '@/app/components/ToolsForm';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Progress } from "@/components/ui/progress"
import { BookText } from 'lucide-react';

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
    <main className="min-h-screen flex flex-col items-center pt-15 p-8 bg-gray-50">
      <Progress value={66} className='w-60' />
      <h1 className="text-4xl font-bold mb-6 mt-2">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Linie {linieId}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/linie/${linieId}`}>Station {stationId}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
        </BreadcrumbList>
      </Breadcrumb>
      </h1>
      <div className="flex flex-wrap gap-4">
        {tools.map((tool) => (
          <div key={tool.id}>
            <Link href={`/linie/${linieId}/station/${stationId}/tools/${tool.id}`}>
              <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
                {tool.name}
                <Button
                  className="p-4 absolute right-2"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    openForm(tool.id);
                  }}
                >
                  <BookText />
                </Button>
              </div>
            </Link>

            {showForm && selectedId === tool.id && (
              <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 border-10">
                <ToolsForm id={tool.id} onClose={closeForm} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
