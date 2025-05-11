import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  tOnClick?: () => void;
  eOnClick?: () => void;
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
              <CardContent className="flex justify-center items-center text-xl font-semibold gap-5">
                {!add && iconsVisible && (
                  <div className="rounded-lg p-1 bg-black text-white">
                    <Trash onClick={tOnClick} className="scale-75" />
                  </div>
                )}
                {add ? "+" : name}
                {!add && iconsVisible && (
                  <div className="rounded-lg p-1 bg-black text-white">
                    <Eye onClick={eOnClick} className="scale-75" />
                  </div>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p>{add ? "Add Line" : description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
