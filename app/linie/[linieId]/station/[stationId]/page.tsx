"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { use, useEffect, useState, useTransition } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Progress } from "@/components/ui/progress";
import { BookText } from "lucide-react";
import { usePathname } from "next/navigation";
import { createEntity, getEntities, init } from "@/app/actions";
import EntityForm from "@/app/components/EntityForm";

export default function StationPage({
  params,
}: {
  params: Promise<{ linieId: string; stationId: string }>;
}) {
  const { linieId, stationId } = use(params);

  interface tool {
    id: number;
    name?: string;
    comment?: string;
    create_state?: string;
    station_id?: string;
    shortname?: string;
    description?: string;
    ip_address?: string;
    class_id?: string;
    sps_id?: string;
    type_id?: string;
  }
  const [tools, setTools] = useState<tool[]>([]);
  const [observer, setObserver] = useState(0);
  const [, startTransition] = useTransition();
  const pathname = usePathname();

  useEffect(() => {
    init();
  }, []);

  async function fetchAndUpdateTools() {
    setTools(await getEntities("tool", parseInt(stationId)));
  }

  useEffect(() => {
    fetchAndUpdateTools();
  }, [observer]);

  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const openForm = (id: number) => {
    setSelectedId(id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedId(null);
  };

  return (
    <main className="flex flex-col items-center pt-15 p-8 ">
      <h1 className="text-3xl font-black">Tools</h1>
      <Progress value={66} className="w-60 mt-7" />
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
          </BreadcrumbList>
        </Breadcrumb>
      </h1>
      <div className="flex flex-wrap gap-4 pt-13">
        {tools.map(({ id, name }) => {
          return (
            <div key={id}>
              <Link href={`${pathname}/tools/${id}`}>
                <div className="w-fit h-fit p-10 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition relative">
                  {(name || "") + " (ID: " + id + ")"}
                  <Button
                    className="p-4 absolute right-2 cursor-pointer"
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

              {showForm && selectedId === id && (
                <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 border-10">
                  <EntityForm
                    id={id}
                    entity={"tool"}
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
            startTransition(async () => {
              createEntity("tool", parseInt(stationId));
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
