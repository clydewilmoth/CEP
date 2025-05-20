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
        <DropdownMenuContent className="w-6">
          <UserDialog />
          <DropdownMenuSeparator className="h-[0.05rem]" />
          <LangDialog />
          <DropdownMenuSeparator className="h-[0.05rem]" />
          <Button variant="ghost" size="icon" onClick={() => setDsnOpen(true)}>
            <Database />
          </Button>
          <DropdownMenuSeparator className="h-[0.05rem]" />
          <ImportJSON />
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
        <h1 className="text-2xl font-bold">{t("NameDialog Title")}</h1>
        <p>{t("NameDialog Description")}</p>

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
        <h1 className="text-2xl font-bold">{t("LangDialog Title")}</h1>
        <p>{t("LangDialog Description")}</p>
        <Select
          onValueChange={(e) => (
            setLang(e), i18n.changeLanguage(e), localStorage.setItem("lang", e)
          )}
          defaultValue={String(lang)}
        >
          <SelectTrigger>
            <SelectValue placeholder="StatusColor" />
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
      <DialogContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="py-5 grid grid-cols-2 gap-8"
          >
            <h1 className="col-span-2 text-2xl font-bold">
              {t("DSN FormTitle")}
            </h1>
            <p className="col-span-2">{t("DSN FormDescription")}</p>
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
            <div className="flex flex-col justify-around ml-2">
              <FormField
                control={form.control}
                name="Encrypted"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1 justify-center">
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          id="Encrypted"
                          className="accent-black w-4 h-4"
                        />
                      </FormControl>
                      <FormLabel
                        htmlFor="Encrypted"
                        className="mb-0 cursor-pointer"
                      >
                        {t("DSN Encrypted")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="TrustServerCertificate"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1 justify-center">
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          id="TrustServerCertificate"
                          className="accent-black w-4 h-4"
                        />
                      </FormControl>
                      <FormLabel
                        htmlFor="TrustServerCertificate"
                        className="mb-0 cursor-pointer"
                      >
                        {t("DSN TrustServer")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="col-span-2 w-1/3 mx-auto"
            >
              {t("Submit")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
