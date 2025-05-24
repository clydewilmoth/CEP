import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu as Burger,
  Database,
  FileDown,
  Globe,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckEnvInExeDir,
  GetPlatformSpecificUserName,
  HandleImport,
  ParseDSNFromEnv,
} from "../../../wailsjs/go/main/Core";
import { DialogHeader } from "../ui/dialog";
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
import { ConfigureAndSaveDSN } from "../../../wailsjs/go/main/Core";

import { useInit } from "@/App";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PasswordInput } from "../ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export function Menu() {
  const { setDsnOpen } = useInit();

  return (
    <>
      <DSNDialog />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Burger />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="mr-[2.85rem]">
          <div className="flex">
            <UserDialog />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDsnOpen(true)}
            >
              <Database />
            </Button>
          </div>
          <DropdownMenuSeparator className="h-[0.05rem]" />
          <div className="flex">
            <LangDialog />
            <ThemeSwitch />
          </div>
          <DropdownMenuSeparator className="h-[0.05rem]" />
          <div className="flex justify-center">
            <ImportJSON />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function UserDialog() {
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
      onOpenChange={async () => {
        name == "" &&
          (setName(await GetPlatformSpecificUserName()),
          localStorage.setItem("name", await GetPlatformSpecificUserName()));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <UserRound />
        </Button>
      </DialogTrigger>
      <DialogContent className="py-10 grid grid-cols-1 gap-8 w-80">
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

function LangDialog() {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState<string | null>(localStorage.getItem("lang"));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe />
        </Button>
      </DialogTrigger>
      <DialogContent className="py-10 grid grid-cols-1 gap-8 w-80">
        <DialogTitle>{t("LangDialog Title")}</DialogTitle>
        <DialogDescription>{t("LangDialog Description")}</DialogDescription>
        <Select
          onValueChange={(e) => (
            setLang(e), i18n.changeLanguage(e), localStorage.setItem("lang", e)
          )}
          defaultValue={String(lang)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("LangDialog Placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="de">Deutsch</SelectItem>
          </SelectContent>
        </Select>
      </DialogContent>
    </Dialog>
  );
}

function ImportJSON() {
  const queryClient = useQueryClient();

  const { mutateAsync: importEntity } = useMutation({
    mutationFn: async () =>
      toast(t(await HandleImport(String(localStorage.getItem("name"))))),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const { t } = useTranslation();

  return (
    <Button variant="ghost" size="icon" onClick={() => importEntity()}>
      <FileDown />
    </Button>
  );
}

export function DSNDialog() {
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
    Encrypted: z.boolean(),
    TrustServerCertificate: z.boolean(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      Host: "localhost",
      Port: 1433,
      Database: "db",
      User: "sa",
      Password: "",
      Encrypted: true,
      TrustServerCertificate: true,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    ConfigureAndSaveDSN(
      values.Host,
      String(values.Port),
      values.Database,
      values.User,
      values.Password,
      values.Encrypted.toString(),
      values.TrustServerCertificate.toString()
    );
    toast(`${t("DSNDialog Toast")}`);
    appRerender();
    setDsnOpen(false);
  }

  const { t } = useTranslation();

  const { dsnOpen, setDsnOpen, appRerender } = useInit();

  useEffect(() => {
    if (dsnOpen) {
      (async () => {
        try {
          const env = await ParseDSNFromEnv();
          if (env) {
            form.reset({
              Host: env.Host || "localhost",
              Port: Number(env.Port) || 1433,
              Database: env.Database || "db",
              User: env.User || "sa",
              Password: env.Password || "",
              Encrypted: env.Encrypt === "true",
              TrustServerCertificate: env.TrustServerCertificate === "true",
            });
          }
        } catch (e) {}
      })();
    }
  }, [dsnOpen]);

  return (
    <Dialog
      open={dsnOpen}
      onOpenChange={async () => {
        setDsnOpen(dsnOpen && (await CheckEnvInExeDir()) ? false : true);
      }}
    >
      <DialogContent className="p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="py-5 grid grid-cols-2 gap-8"
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
                        <PasswordInput placeholder="" {...field} />
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
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="hover:cursor-pointer"
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
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="hover:cursor-pointer"
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

import { useTheme } from "next-themes";
import { ScrollArea } from "../ui/scroll-area";

function ThemeSwitch() {
  const { setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() =>
        setTheme(localStorage.getItem("theme") == "light" ? "dark" : "light")
      }
    >
      {localStorage.getItem("theme") == "light" ? <Moon /> : <Sun />}
    </Button>
  );
}
