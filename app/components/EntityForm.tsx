"use client";

import { useState, useEffect } from "react";
import { getEntityDetails, updateEntity } from "../actions";

type FormProps = {
  id: number;
  entity: string;
  onClose: () => void;
};

export default function EntityForm({ id, entity, onClose }: FormProps) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [create_state, setCreate_state] = useState("");

  const [line_id, setLine_id] = useState(0);
  const [station_type_id, setStation_type_id] = useState("");
  const [state, setState] = useState("");

  const [station_id, setStation_id] = useState(0);
  const [tool_shortname, setTool_shortname] = useState("");
  const [tool_description, setTool_description] = useState("");
  const [ip_address, setIp_address] = useState("");
  const [class_id, setClass_id] = useState("");
  const [sps_id, setSps_id] = useState("");
  const [tool_type_id, setTool_type_id] = useState("");

  const [tool_id, setTool_id] = useState(0);
  const [operation_shortname, setOperation_shortname] = useState("");
  const [operation_description, setOperation_description] = useState("");
  const [decision_criteria, setDecision_criteria] = useState("");
  const [sequence_group, setSequence_group] = useState("");
  const [always_perform, setAlways_perform] = useState("");
  const [serial_or_paralel, setSerial_or_paralel] = useState("");
  const [eks_ip, setEks_ip] = useState("");
  const [template_id, setTemplate_id] = useState("");
  const [q_gate_relevant_id, setQ_gate_relevant_id] = useState("");
  const [decision_class_id, setDecision_class_id] = useState("");
  const [saving_class_id, setSaving_class_id] = useState("");
  const [verification_class_id, setVerification_class_id] = useState("");
  const [general_class_id, setGeneral_class_id] = useState("");

  const handleCancel = () => {
    console.log("Abgebrochen.");
    onClose();
  };

  async function loadAndShowDetails() {
    const {
      name,
      comment,
      create_state,
      line_id,
      type_id,
      state,
      station_id,
      shortname,
      description,
      ip_address,
      class_id,
      sps_id,
      tool_id,
      decision_criteria,
      sequence_group,
      always_perform,
      serial_or_paralel,
      eks_ip,
      template_id,
      q_gate_relevant_id,
      decision_class_id,
      saving_class_id,
      verification_class_id,
      general_class_id,
    } = await getEntityDetails(entity, id);
    setName(name || "");
    setComment(comment || "");
    setCreate_state(create_state || "");
    setLine_id(line_id || 0);
    setStation_type_id(type_id || "");
    setState(state || "");
    setStation_id(station_id || 0);
    setTool_shortname(shortname || "");
    setTool_description(description || "");
    setIp_address(ip_address || "");
    setClass_id(class_id || "");
    setSps_id(sps_id || "");
    setTool_type_id(type_id || "");
    setTool_id(tool_id || 0);
    setOperation_shortname(shortname || "");
    setOperation_description(description || "");
    setDecision_criteria(decision_criteria || "");
    setSequence_group(sequence_group || "");
    setAlways_perform(always_perform || "");
    setSerial_or_paralel(serial_or_paralel || "");
    setEks_ip(eks_ip || "");
    setTemplate_id(template_id || "");
    setQ_gate_relevant_id(q_gate_relevant_id || "");
    setDecision_class_id(decision_class_id || "");
    setSaving_class_id(saving_class_id || "");
    setVerification_class_id(verification_class_id || "");
    setGeneral_class_id(general_class_id || "");
  }

  useEffect(() => {
    loadAndShowDetails();
  });

  return (
    <div className="w-96 max-h-[80vh] overflow-auto relative bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl mb-4">{(name || "") + " (ID: " + id + ")"}</h2>
      <div className="flex justify-end gap-4 mt-4">
        <button
          onClick={handleCancel}
          className="px-4 py-2 border rounded cursor-pointer"
        >
          X
        </button>
      </div>
      Name
      <input
        type="text"
        value={name}
        onChange={(e) => {
          updateEntity(entity, id, "name", e.target.value);
          setName(e.target.value);
        }}
        className="border p-2 w-full rounded mb-4"
        placeholder={`...`}
      />
      Kommentar
      <input
        type="text"
        value={comment}
        onChange={(e) => {
          updateEntity(entity, id, "comment", e.target.value);
          setComment(e.target.value);
        }}
        className="border p-2 w-full rounded mb-4"
        placeholder={`...`}
      />
      Status
      <input
        type="text"
        value={create_state}
        onChange={(e) => {
          updateEntity(entity, id, "create_state", e.target.value);
          setCreate_state(e.target.value);
        }}
        className="border p-2 w-full rounded mb-4"
        placeholder={`...`}
      />
      {entity === "line" ? (
        ""
      ) : entity === "station" ? (
        <>
          Linie ID
          <input
            type="text"
            value={line_id}
            onChange={(e) => {
              updateEntity(entity, id, "line_id", e.target.value);
              setLine_id(parseInt(e.target.value));
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
            disabled
          />
          Aktiv
          <input
            type="text"
            value={state}
            onChange={(e) => {
              updateEntity(entity, id, "state", e.target.value);
              setState(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Typ ID
          <input
            type="text"
            value={station_type_id}
            onChange={(e) => {
              updateEntity(entity, id, "type_id", e.target.value);
              setStation_type_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
        </>
      ) : entity === "tool" ? (
        <>
          Station ID
          <input
            type="text"
            value={station_id}
            onChange={(e) => {
              updateEntity(entity, id, "station_id", e.target.value);
              setStation_id(parseInt(e.target.value));
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
            disabled
          />
          Kurzname
          <input
            type="text"
            value={tool_shortname}
            onChange={(e) => {
              updateEntity(entity, id, "shortname", e.target.value);
              setTool_shortname(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Beschreibung
          <input
            type="text"
            value={tool_description}
            onChange={(e) => {
              updateEntity(entity, id, "description", e.target.value);
              setTool_description(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          IP Adresse
          <input
            type="text"
            value={ip_address}
            onChange={(e) => {
              updateEntity(entity, id, "ip_address", e.target.value);
              setIp_address(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Klasse ID
          <input
            type="text"
            value={class_id}
            onChange={(e) => {
              updateEntity(entity, id, "class_id", e.target.value);
              setClass_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          SPS ID
          <input
            type="text"
            value={sps_id}
            onChange={(e) => {
              updateEntity(entity, id, "sps_id", e.target.value);
              setSps_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Typ ID
          <input
            type="text"
            value={tool_type_id}
            onChange={(e) => {
              updateEntity(entity, id, "type_id", e.target.value);
              setTool_type_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
        </>
      ) : (
        <>
          Tool ID
          <input
            type="text"
            value={tool_id}
            onChange={(e) => {
              updateEntity(entity, id, "tool_id", e.target.value);
              setTool_id(parseInt(e.target.value));
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
            disabled
          />
          Kurzname
          <input
            type="text"
            value={operation_shortname}
            onChange={(e) => {
              updateEntity(entity, id, "shortname", e.target.value);
              setOperation_shortname(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Beschreibung
          <input
            type="text"
            value={operation_description}
            onChange={(e) => {
              updateEntity(entity, id, "description", e.target.value);
              setOperation_description(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Entscheidungskriterium
          <input
            type="text"
            value={decision_criteria}
            onChange={(e) => {
              updateEntity(entity, id, "decision_criteria", e.target.value);
              setDecision_criteria(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Sequenz Gruppe
          <input
            type="text"
            value={sequence_group}
            onChange={(e) => {
              updateEntity(entity, id, "sequence_group", e.target.value);
              setSequence_group(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Immer ausführen
          <input
            type="text"
            value={always_perform}
            onChange={(e) => {
              updateEntity(entity, id, "always_perform", e.target.value);
              setAlways_perform(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Seriell oder parallel
          <input
            type="text"
            value={serial_or_paralel}
            onChange={(e) => {
              updateEntity(entity, id, "serial_or_paralel", e.target.value);
              setSerial_or_paralel(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          EKS IP
          <input
            type="text"
            value={eks_ip}
            onChange={(e) => {
              updateEntity(entity, id, "eks_ip", e.target.value);
              setEks_ip(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Template ID
          <input
            type="text"
            value={template_id}
            onChange={(e) => {
              updateEntity(entity, id, "template_id", e.target.value);
              setTemplate_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Q Gate relevante ID
          <input
            type="text"
            value={q_gate_relevant_id}
            onChange={(e) => {
              updateEntity(entity, id, "q_gate_relevant_id", e.target.value);
              setQ_gate_relevant_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Entscheidung Klasse ID
          <input
            type="text"
            value={decision_class_id}
            onChange={(e) => {
              updateEntity(entity, id, "decision_class_id", e.target.value);
              setDecision_class_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Speicher Klasse ID
          <input
            type="text"
            value={saving_class_id}
            onChange={(e) => {
              updateEntity(entity, id, "saving_class_id", e.target.value);
              setSaving_class_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Verifizierung Klasse ID
          <input
            type="text"
            value={verification_class_id}
            onChange={(e) => {
              updateEntity(entity, id, "verification_class_id", e.target.value);
              setVerification_class_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
          Allgemeine Klasse ID
          <input
            type="text"
            value={general_class_id}
            onChange={(e) => {
              updateEntity(entity, id, "general_class_id", e.target.value);
              setGeneral_class_id(e.target.value);
            }}
            className="border p-2 w-full rounded mb-4"
            placeholder={`...`}
          />
        </>
      )}
    </div>
  );
}
