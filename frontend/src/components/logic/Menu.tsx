import { Button } from "@/components/ui/button";
import { Database, Globe, Moon, Sun, UserRound } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GetPlatformSpecificUserName } from "../../../wailsjs/go/main/Core";
import { Input } from "../ui/input";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

import { useContext } from "@/store";
import { toast } from "sonner";
import { PasswordInput } from "../ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import { useTheme } from "next-themes";
import { ScrollArea } from "../ui/scroll-area";
import { Sidebar, SidebarBody, SidebarMenu, useSidebar } from "../ui/sidebar";
import { t } from "i18next";
import { Checkbox } from "../ui/checkbox";
import { booleanToString, stringToBoolean } from "@/lib/utils";

export function UserDialog({
  onDialogStateChange,
}: {
  onDialogStateChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState<string | null>();
  useEffect(() => {
    async function fetchAndSetName() {
      setName(await GetPlatformSpecificUserName());
    }
    localStorage.getItem("name") == null
      ? fetchAndSetName()
      : setName(localStorage.getItem("name"));
  }, []);

  return (
    <Dialog
      onOpenChange={async (open) => {
        name == "" &&
          (setName(await GetPlatformSpecificUserName()),
          localStorage.setItem("name", await GetPlatformSpecificUserName()));
        onDialogStateChange && onDialogStateChange(open);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-10 h-10">
          <UserRound />
        </Button>
      </DialogTrigger>
      <DialogContent className="py-10 grid grid-cols-1 gap-5 w-80">
        <DialogTitle>{t("NameDialog Title")}</DialogTitle>
        <DialogDescription>{t("NameDialog Description")}</DialogDescription>
        <Input
          id="name"
          value={String(name)}
          onChange={(e) => (
            setName(e.target.value),
            localStorage.setItem("name", e.target.value)
          )}
        />
      </DialogContent>
    </Dialog>
  );
}

export function LangDialog({
  onDialogStateChange,
}: {
  onDialogStateChange?: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <Dialog
      onOpenChange={(open) => {
        onDialogStateChange && onDialogStateChange(open);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-10 h-10">
          <Globe />
        </Button>
      </DialogTrigger>
      <DialogContent className="py-10 grid grid-cols-1 gap-5 w-80">
        <DialogTitle>{t("LangDialog Title")}</DialogTitle>
        <DialogDescription>{t("LangDialog Description")}</DialogDescription>
        <Select
          value={localStorage.getItem("lang") ?? "en"}
          onValueChange={(e) => (
            i18n.changeLanguage(e), localStorage.setItem("lang", e)
          )}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("LangDialog Placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="tr">Türkçe</SelectItem>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="pt">Português</SelectItem>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="jp">日本語</SelectItem>
            <SelectItem value="zh">中国人</SelectItem>
          </SelectContent>
        </Select>
      </DialogContent>
    </Dialog>
  );
}

export function setDatabaseConnection(
  host: string,
  port: string,
  database: string,
  user: string,
  password: string,
  encrypted: string,
  trustserver: string
): void {
  const json = {
    user: user,
    password: password,
    host: host,
    port: port,
    database: database,
    encrypted: encrypted,
    trustserver: trustserver,
  };
  localStorage.setItem("database", JSON.stringify(json));
  localStorage.setItem(
    "dsn",
    `sqlserver://${user}:${password}@${host}:${port}?database=${database}&encrypt=${encrypted}&trustservercertificate=${trustserver}`
  );
}

export function DSNDialog({
  onDialogStateChange,
}: {
  onDialogStateChange?: (open: boolean) => void;
}) {
  const formSchema = z.object({
    Host: z.string().min(1, {
      message: "Required!",
    }),
    Port: z.number().min(1, {
      message: "Required!",
    }),
    Database: z.string().min(1, {
      message: "Required!",
    }),
    User: z.string().min(1, {
      message: "Required!",
    }),
    Password: z.string().min(1, {
      message: "Required!",
    }),
    Encrypted: z.string(),
    TrustServerCertificate: z.string(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      Host: "localhost",
      Port: 1433,
      Database: "db",
      User: "sa",
      Password: "",
      Encrypted: "true",
      TrustServerCertificate: "true",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setDatabaseConnection(
      values.Host,
      String(values.Port),
      values.Database,
      values.User,
      values.Password,
      values.Encrypted,
      values.TrustServerCertificate
    );
    toast.success(`${t("DSNDialog Toast")}`);
    tryInitialise();
    onDialogStateChange && onDialogStateChange(false);
    setOpen(false);
  }

  const { t } = useTranslation();

  const { tryInitialise } = useContext();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    !localStorage.getItem("dsn") &&
      (setOpen(true), onDialogStateChange && onDialogStateChange(true));
  }, []);

  useEffect(() => {
    (async () => {
      const db = JSON.parse(localStorage.getItem("database") ?? "{}");
      db != "{}" &&
        form.reset({
          Host: db.host || "localhost",
          Port: Number(db.port) || 1433,
          Database: db.database || "db",
          User: db.user || "sa",
          Password: db.password || "",
          Encrypted: db.encrypted || "true",
          TrustServerCertificate: db.trustserver || "true",
        });
    })();
  }, [open]);
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onDialogStateChange && onDialogStateChange(open);
        setOpen(open);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-10 h-10">
          <Database />
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 w-1/2">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="py-3 grid grid-cols-2 gap-5"
              >
                <DialogTitle className="col-span-2">
                  {t("DSN FormTitle")}
                </DialogTitle>
                <DialogDescription className="col-span-2">
                  {t("DSN FormDescription")}
                </DialogDescription>
                <FormField
                  control={form.control}
                  name="Host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Host")}</FormLabel>
                      <FormControl>
                        <Input placeholder="localhost" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="Port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Port")}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1433" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="Database"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("DSN Database")}</FormLabel>
                      <FormControl>
                        <Input placeholder="db" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="User"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("DSN User")}</FormLabel>
                      <FormControl>
                        <Input placeholder="sa" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="Password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("DSN Password")}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder=""
                          {...field}
                          autoComplete=""
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex flex-col items-start justify-center gap-2 rounded-md pl-4 border">
                  <FormField
                    control={form.control}
                    name="Encrypted"
                    render={({ field }) => (
                      <FormItem className="flex gap-2 justify-center space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={stringToBoolean(field.value)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                booleanToString(checked as boolean)
                              )
                            }
                          />
                        </FormControl>
                        <FormLabel className="hover:cursor-pointer">
                          {t("DSN Encrypted")}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="TrustServerCertificate"
                    render={({ field }) => (
                      <FormItem className="flex gap-2 justify-center space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={stringToBoolean(field.value)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                booleanToString(checked as boolean)
                              )
                            }
                          />
                        </FormControl>
                        <FormLabel className="hover:cursor-pointer">
                          {t("DSN TrustServer")}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  variant="outline"
                  type="submit"
                  className="col-span-2 w-1/3 mx-auto"
                >
                  {t("Submit")}
                </Button>
              </form>
            </Form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function ThemeSwitch() {
  const { setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      className="w-10 h-10"
      onClick={() =>
        setTheme(localStorage.getItem("theme") == "light" ? "dark" : "light")
      }
    >
      {localStorage.getItem("theme") == "light" ? <Moon /> : <Sun />}
    </Button>
  );
}

export function Menu() {
  const [open, setOpen] = useState(false);
  const [isAnyDialogOpen, setIsAnyDialogOpen] = useState(false);
  const [preventSidebarOpen, setPreventSidebarOpen] = useState(false);
  const handleDialogStateChange = (dialogOpen: boolean) => {
    setIsAnyDialogOpen(dialogOpen);
    if (dialogOpen) {
      setOpen(false);
    } else {
      setOpen(false);
      setPreventSidebarOpen(true);
      setTimeout(() => setPreventSidebarOpen(false), 100);
    }
  };

  const truncateName = (name: string | null): string => {
    if (!name) return "";
    return name.length > 15 ? name.substring(0, 15) + "..." : name;
  };
  const handleSetOpen = (value: React.SetStateAction<boolean>) => {
    const newOpen = typeof value === "function" ? value(open) : value;

    if (newOpen && (isAnyDialogOpen || preventSidebarOpen)) {
      return;
    }
    setOpen(newOpen);
  };

  return (
    <Sidebar
      open={open && !isAnyDialogOpen && !preventSidebarOpen}
      setOpen={handleSetOpen}
    >
      <MenuContent
        handleDialogStateChange={handleDialogStateChange}
        truncateName={truncateName}
      />
    </Sidebar>
  );
}

function MenuContent({
  handleDialogStateChange,
  truncateName,
}: {
  handleDialogStateChange: (open: boolean) => void;
  truncateName: (name: string | null) => string;
}) {
  const { simulateMouseLeave, checkMousePosition } = useSidebar();
  const handleDialogStateChangeWithMouseLeave = (dialogOpen: boolean) => {
    if (dialogOpen && simulateMouseLeave) {
      simulateMouseLeave();
    }

    handleDialogStateChange(dialogOpen);

    if (!dialogOpen && checkMousePosition) {
      setTimeout(() => {
        checkMousePosition();
      }, 150);
    }
  };

  return (
    <SidebarBody className="justify-between gap-10 overflow-hidden">
      <div className="flex flex-col">
        <SidebarMenu
          item={
            <DSNDialog
              onDialogStateChange={handleDialogStateChangeWithMouseLeave}
            />
          }
          text={t("Database")}
        />
        <SidebarMenu
          item={
            <LangDialog
              onDialogStateChange={handleDialogStateChangeWithMouseLeave}
            />
          }
          text={t("Language")}
        />
        <SidebarMenu item={<ThemeSwitch />} text={t("Theme")} />
      </div>
      <SidebarMenu
        item={
          <UserDialog
            onDialogStateChange={handleDialogStateChangeWithMouseLeave}
          />
        }
        text={truncateName(localStorage.getItem("name"))}
      />
    </SidebarBody>
  );
}
