"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';


const LiniePage = () =>{
  const station = ['Station 1', 'Station 2', 'Station 3', 'Station 4'];
  const { linieId } = useParams();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8">cep</h1>
      <div className="flex flex-wrap gap-4">
        {station.map((station, index) => (
          <Link key={index} href={`/linie/${linieId}/station/${index + 1}`}>
            <div className="w-40 h-24 flex items-center justify-center border rounded-lg shadow-md hover:shadow-lg transition">
              {station}
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

export default LiniePage;