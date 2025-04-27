"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';


const StationPage = () =>{
  const tools = ['Tool 1', 'Tool 2', 'Tool 3', 'Tool 4'];
  const { linieId, stationId } = useParams();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8">cep</h1>
      <div className="flex flex-wrap gap-4">
        {tools.map((tools, index) => (
          <Link key={index} href={`/linie/${linieId}/station/${stationId}/tools/${index + 1}`}>
            <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition">
              {tools}
            </div>
          </Link>
        ))}
        <button className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition text-2xl">
          +
        </button>
      </div>
    </main>
  );
}


export default StationPage