import { useLocation } from "wouter";
import React from "react";


export function SelectedVersion(version: string) {
  const [, navigate] = useLocation();
  navigate("/oldVersion/" + version, {
    replace: true,
  });

}

