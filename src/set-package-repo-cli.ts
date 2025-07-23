#!/usr/bin/env node
import yargs from "yargs";
import { type Options, setPackageRepo } from "./set-package-repo";
import { fileExists } from "yafs";
import { ExecStepContext } from "exec-step";

export interface CliOptions extends Options {
    _: string[];
    filePaths: string[];
}

function gatherOptions(): CliOptions {
    const parsed = yargs(process.argv.slice(2))
        .usage(`usage: $0 [options]
negate any boolean option by prepending --no-`)
        .option("force", {
            type: "boolean",
            default: false,
            demandOption: false,
            description: "Force overwriting repository information"
        }).option("homepage", {
            type: "boolean",
            demandOption: false,
            default: false,
            description: "Also set the homepage field from the git repo url"
        }).argv as unknown as CliOptions;
    parsed.filePaths = [ ...parsed._ ];
    return parsed;
}

(async function main() {
    const options = gatherOptions();
    if (options.filePaths.length === 0) {
        console.error("Please provide one or more paths to package.json files to modify");
    }
    const ctx = new ExecStepContext({
        throwErrors: false,
        suppressErrorReporting: true
    });
    for (const file of options.filePaths) {
        let message: string | undefined = "";
        await ctx.exec(`update: ${file}`,
            async () => {
                if (!await fileExists(file)) {
                    throw new Error(`file not found: ${file}`);
                }
                const result = await setPackageRepo(file, options);
                if (!result.success) {
                    message = result.message;
                }
            }
        );
        if (message) {
            console.warn(`  ${message}`);
        }
    }
})();
