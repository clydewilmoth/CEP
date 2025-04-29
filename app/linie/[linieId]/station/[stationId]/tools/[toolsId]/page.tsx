"use client";

import { Button } from "@/components/ui/button";
import { use, useState } from "react";
import OperationForm from "@/app/components/OperationForm";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Progress } from "@/components/ui/progress";
import { BookText } from "lucide-react";

export default function ToolsPage({
  params,
}: {
  params: Promise<{ linieId: string; stationId: string; toolsId: string }>;
}) {
  const { linieId, stationId, toolsId } = use(params);

  const operationen = [
    { id: "1", name: "Operation 1" },
    { id: "2", name: "Operation 2" },
    { id: "3", name: "Operation 3" },
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
      <Progress value={100} className="w-60" />
      <h1 className="text-4xl font-bold mb-6 mt-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Linie {linieId}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/linie/${linieId}`}>
                Station {stationId}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/linie/${linieId}/station/${stationId}`}>
                Tool {toolsId}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </BreadcrumbList>
        </Breadcrumb>
      </h1>
      <div className="flex flex-wrap gap-4">
        {operationen.map((operation) => (
          <div key={operation.id}>
            <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
              {operation.name}
              <Button
                className="p-4 absolute right-2"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  openForm(operation.id);
                }}
              >
                <BookText />
              </Button>
            </div>
            {showForm && selectedId === operation.id && (
              <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 border-10">
                <OperationForm id={operation.id} onClose={closeForm} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
