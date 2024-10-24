import { stat } from "node:fs/promises";
import { spawn, SpawnOptions } from "node:child_process";
import { COLORS } from "./colors";

export const exists = async (path: string) =>
  stat(path)
    .then(() => true)
    .catch(() => false);

export const sleep = (delay: number) =>
  new Promise<void>((resolve, _) => setTimeout(() => resolve(), delay));

type ExecuteOptions = {
  command: string;
  args: Array<string | number>;
  name: string;
  silent: boolean;
  cwd: string;
  shell: boolean;
};
export const execute = (options: Partial<ExecuteOptions>) => {
  const defaultOpts: ExecuteOptions = {
    command: "",
    args: [],
    name: "PROCESS",
    silent: true,
    cwd: process.cwd(),
    shell: false,
  };
  const { command, cwd, args, name, silent, shell } = {
    ...defaultOpts,
    ...options,
  };
  return new Promise((resolve, reject) => {
    const stringArgs = args.map((arg) => String(arg));
    const spawnOptions: SpawnOptions = { cwd, shell };
    const ps = spawn(command, stringArgs, spawnOptions);
    if (!silent)
      ps.stdout?.on("data", (data) =>
        console.log(
          COLORS.FgMagenta,
          `[${name}]`,
          COLORS.FgWhite,
          data.toString().trimEnd(),
        ),
      );
    ps.stderr?.on("data", (data) =>
      console.log(
        COLORS.FgMagenta,
        `[${name}]`,
        COLORS.FgRed,
        data.toString().trimEnd(),
      ),
    );
    ps.on("close", (code) => {
      console.log(
        COLORS.FgMagenta,
        `[${name}]`,
        COLORS.FgYellow,
        `${command} with args [${args.join(",")}] closed with code ${code}`,
      );
      code === 0 || code === null ? resolve("Success") : reject("Failure");
    });
  });
};
