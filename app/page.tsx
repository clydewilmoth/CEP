"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTransition, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { BookText } from "lucide-react";
import { init } from "./actions";
import { useEffect } from "react";
import { getEntities, createEntity } from "./actions";
import EntityForm from "./components/EntityForm";

export default function Home() {
  interface line {
    id: number;
    name?: string;
    comment?: string;
    create_state?: string;
  }
  const [lines, setLines] = useState<line[]>([]);
  const [observer, setObserver] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    init();
  }, []);

  async function fetchAndUpdateLines() {
    setLines(await getEntities("line", 0));
  }

  useEffect(() => {
    fetchAndUpdateLines();
  }, [observer]);

  const [showForm, setShowForm] = useState(false);
  const [selectedLinieId, setSelectedLinieId] = useState<number | null>(null);

  const openForm = (linieId: number) => {
    setSelectedLinieId(linieId);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedLinieId(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-8 bg-gray-50">
      <Progress value={0} className="w-60 mt-7" />
      <div className="flex flex-wrap gap-4 pt-13">
        {lines.map(({ id, name }) => {
          return (
            <div key={id}>
              <Link href={`/linie/${id}`}>
                <div className="w-fit h-fit p-10 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
                  {(name || "") + " (ID: " + id + ")"}
                  <Button
                    className="p-4 absolute right-2"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      openForm(id);
                    }}
                  >
                    <BookText />
                  </Button>
                </div>
              </Link>

              {showForm && selectedLinieId === id && (
                <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 border-10">
                  <EntityForm
                    id={id}
                    entity={"line"}
                    onClose={() => {
                      closeForm();
                      setObserver(observer + 1);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        <div
          className="w-24 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg hover:cursor-pointer transition relative"
          onClick={() => {
            startTransition(() => {
              createEntity("line", 0);
              setObserver(observer + 1);
            });
          }}
        >
          +
        </div>
      </div>
    </main>
  );
}
