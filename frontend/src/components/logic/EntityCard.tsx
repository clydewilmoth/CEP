import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Trash, Eye } from "lucide-react";

export default function EntityCard({
  name,
  description,
  onClick,
  tOnClick,
  eOnClick,
  add,
}: {
  name: string;
  description: string;
  onClick: () => void;
  tOnClick: () => void;
  eOnClick: () => void;
  add: boolean;
}) {
  const [iconsVisible, setIconsVisible] = React.useState<boolean>(false);

  return (
    <div onClick={onClick}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card
              className="w-fit flex justify-center items-center hover:cursor-pointer p-5"
              onMouseEnter={() => setIconsVisible(true)}
              onMouseLeave={() => setIconsVisible(false)}
            >
              <CardContent className="flex justify-center items-center font-semibold gap-5 flex-col">
                {add ? "+" : name}

                {!add && iconsVisible && (
                  <div className="flex justify-center items-center gap-4">
                    <div
                      className="rounded-lg p-1 bg-black text-white"
                      onClick={tOnClick}
                    >
                      <Trash className="scale-75" />
                    </div>
                    <div
                      className="rounded-lg p-1 bg-black text-white"
                      onClick={eOnClick}
                    >
                      <Eye className="scale-75" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          {description != "" && (
            <TooltipContent>
              <p>{description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
