import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { GetEntityDetails } from "../../../wailsjs/go/main/Core";
import { useEffect, useState } from "react";
import { useContext } from "../../store";
import { Skeleton } from "../ui/skeleton";
import { useDelayedLoading } from "@/lib/hooks";

export function BreadcrumbNavigation({
  luuid,
  suuid,
  tuuid,
  ouuid,
}: {
  luuid?: string;
  suuid?: string;
  tuuid?: string;
  ouuid?: string;
}) {
  const { dbState } = useContext();
  const [location, navigate] = useLocation();
  const { t } = useTranslation();
  const [lName, setLName] = useState("");
  const [sName, setSName] = useState("");
  const [tName, setTName] = useState("");
  const [oName, setOName] = useState("");
  const [navReady, setNavReady] = useState(false);

  // Use delayed loading to prevent skeleton flickering
  const showSkeletons = useDelayedLoading(!navReady);

  useEffect(() => {
    (async () => {
      const lDetails = luuid && (await GetEntityDetails("line", luuid ?? ""));
      const sDetails =
        suuid && (await GetEntityDetails("station", suuid ?? ""));
      const tDetails = tuuid && (await GetEntityDetails("tool", tuuid ?? ""));
      const oDetails =
        ouuid && (await GetEntityDetails("operation", ouuid ?? ""));

      setLName(lDetails?.Name ?? "");
      setSName(sDetails?.Name ?? "");
      setTName(tDetails?.Name ?? "");
      setOName(oDetails?.Name ?? "");

      setNavReady(true);
    })();
  }, [location, dbState]);

  return (
    <div className="min-h-fit pb-3" key={location}>
      <Breadcrumb>
        <BreadcrumbList>
          <div className="w-full flex items-center">
            <BreadcrumbItem>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/", { replace: true })}
              >
                <Home />
              </Button>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </div>
          {luuid && (
            <div className="w-full flex items-center">
              <BreadcrumbItem>
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/line/${luuid}`, { replace: true })}
                  disabled={suuid ? false : true}
                  className="text-base text-foreground opacity-50 disabled:opacity-100 px-2"
                >
                  {" "}
                  {`${t("line")} ${lName}`}
                  {showSkeletons && <Skeleton className="w-24 h-8" />}
                </Button>
              </BreadcrumbItem>
              {suuid && <BreadcrumbSeparator />}
            </div>
          )}
          {suuid && (
            <div className="w-full flex items-center">
              <BreadcrumbItem>
                <BreadcrumbLink>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      navigate(`/line/${luuid}/station/${suuid}`, {
                        replace: true,
                      })
                    }
                    disabled={tuuid ? false : true}
                    className="text-base text-foreground opacity-50 disabled:opacity-100 px-2"
                  >
                    {" "}
                    {`${t("station")} ${sName}`}
                    {showSkeletons && <Skeleton className="w-24 h-8" />}
                  </Button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {tuuid && <BreadcrumbSeparator />}
            </div>
          )}
          {tuuid && (
            <div className="w-full flex items-center">
              <BreadcrumbItem>
                <BreadcrumbLink>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        `/line/${luuid}/station/${suuid}/tool/${tuuid}`,
                        {
                          replace: true,
                        }
                      )
                    }
                    disabled={ouuid ? false : true}
                    className="text-base text-foreground opacity-50 disabled:opacity-100 px-2"
                  >
                    {" "}
                    {`${t("tool")} ${tName}`}
                    {showSkeletons && <Skeleton className="w-24 h-8" />}
                  </Button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {ouuid && <BreadcrumbSeparator />}
            </div>
          )}
          {ouuid && (
            <div className="w-full flex items-center">
              <BreadcrumbItem>
                <BreadcrumbLink>
                  <Button
                    variant="ghost"
                    disabled
                    className="text-base text-foreground opacity-50 disabled:opacity-100 px-2"
                  >
                    {" "}
                    {`${t("operation")} ${oName}`}
                    {showSkeletons && <Skeleton className="w-24 h-8" />}
                  </Button>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </div>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
