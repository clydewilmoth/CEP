"use client";

import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext, useRef } from "react";
import { motion } from "framer-motion";

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
  simulateMouseLeave?: () => void;
  setMouseLeaveHandler?: (handler: () => void) => void;
  setMouseEnterHandler?: (handler: () => void) => void;
  setSidebarElement?: (element: HTMLDivElement | null) => void;
  checkMousePosition?: () => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const mouseLeaveHandlerRef = useRef<(() => void) | undefined>(undefined);
  const mouseEnterHandlerRef = useRef<(() => void) | undefined>(undefined);
  const sidebarElementRef = useRef<HTMLDivElement | null>(null);
  const lastMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const simulateMouseLeave = () => {
    if (mouseLeaveHandlerRef.current) {
      mouseLeaveHandlerRef.current();
    }
  };

  const setMouseLeaveHandler = (handler: () => void) => {
    mouseLeaveHandlerRef.current = handler;
  };

  const setMouseEnterHandler = (handler: () => void) => {
    mouseEnterHandlerRef.current = handler;
  };

  const setSidebarElement = (element: HTMLDivElement | null) => {
    sidebarElementRef.current = element;
  };

  const checkMousePosition = () => {
    if (open || !sidebarElementRef.current || !mouseEnterHandlerRef.current) {
      return;
    }

    const { x, y } = lastMousePositionRef.current;
    const rect = sidebarElementRef.current.getBoundingClientRect();

    const isMouseOverSidebar =
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

    if (isMouseOverSidebar && mouseEnterHandlerRef.current) {
      mouseEnterHandlerRef.current();
    }
  };

  return (
    <SidebarContext.Provider
      value={{
        open,
        setOpen,
        animate,
        simulateMouseLeave,
        setMouseLeaveHandler,
        setMouseEnterHandler,
        setSidebarElement,
        checkMousePosition,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return <DesktopSidebar {...props} />;
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const {
    open,
    setOpen,
    animate,
    setMouseLeaveHandler,
    setMouseEnterHandler,
    setSidebarElement,
  } = useSidebar();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!open) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setOpen(true);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setOpen(false);
  };

  React.useEffect(() => {
    if (!open && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [open]);

  React.useEffect(() => {
    if (setMouseLeaveHandler) {
      setMouseLeaveHandler(handleMouseLeave);
    }
    if (setMouseEnterHandler) {
      setMouseEnterHandler(handleMouseEnter);
    }
    if (setSidebarElement && sidebarRef.current) {
      setSidebarElement(sidebarRef.current);
    }
  }, [setMouseLeaveHandler, setMouseEnterHandler, setSidebarElement]);

  return (
    <motion.div
      ref={sidebarRef}
      className={cn(
        "h-full px-[0.55rem] py-4 flex flex-col flex-shrink-0 min-w-0",
        className
      )}
      animate={{
        width: animate ? (open ? "12.5rem" : "3.75rem") : "3.75rem",
        minWidth: animate ? (open ? "12.5rem" : "3.75rem") : "3.75rem",
        maxWidth: animate ? (open ? "12.5rem" : "3.75rem") : "3.75rem",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const SidebarMenu = ({
  item,
  text,
  className,
}: {
  item: any;
  text: string;
  className?: string;
}) => {
  const { open, animate } = useSidebar();
  return (
    <div
      className={cn(
        "flex items-center justify-start gap-2 group/sidebar py-2",
        className
      )}
    >
      {item}
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "none",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {text}
      </motion.span>
    </div>
  );
};
