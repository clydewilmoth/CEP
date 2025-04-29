"use client";

import { useState, useEffect } from "react";
import { getEntityDetails, updateEntity } from "../actions";

type FormProps = {
  id: number;
  onClose: () => void;
};

export default function LinieForm({ id, onClose }: FormProps) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [create_state, setCreate_state] = useState("");

  async function loadAndShowDetails() {
    const { name, comment, create_state } = await getEntityDetails("line", id);
    setName(name);
    setComment(comment);
    setCreate_state(create_state);
  }

  useEffect(() => {
    loadAndShowDetails();
  });

  const handleCancel = () => {
    console.log("Abgebrochen.");
    onClose();
  };

  return (
    <div className="w-96 relative bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl mb-4">Linie {id} bearbeiten</h2>
      Name
      <input
        type="text"
        value={name}
        onChange={(e) => {
          updateEntity("line", id, "name", e.target.value);
          setName(e.target.value);
        }}
        className="border p-2 w-full rounded mb-4"
        placeholder={`Name`}
      />
      Kommentar
      <input
        type="text"
        value={comment}
        onChange={(e) => {
          updateEntity("line", id, "comment", e.target.value);
          setComment(e.target.value);
        }}
        className="border p-2 w-full rounded mb-4"
        placeholder={`Kommentar`}
      />
      Status
      <input
        type="text"
        value={create_state}
        onChange={(e) => {
          updateEntity("line", id, "create_state", e.target.value);
          setCreate_state(e.target.value);
        }}
        className="border p-2 w-full rounded mb-4"
        placeholder={`Status`}
      />
      <div className="flex justify-end gap-4 mt-4">
        <button onClick={handleCancel} className="px-4 py-2 border rounded">
          Cancel
        </button>
      </div>
    </div>
  );
}
