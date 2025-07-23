import which from "which";
import path from "path";
import { readTextFile, writeTextFile } from "yafs";
import { simpleGit, type RemoteWithRefs } from "simple-git";

export interface Options {
    force?: boolean;
    homepage?: boolean;
}

enum GitError {
    notInitialised,
    noRemotes
}

export interface SetPackageRepoResult {
    success: boolean;
    message?: string;
}

const defaultOptions: Options = {
    force: false,
    homepage: true
};

export async function setPackageRepo(
    packageJsonPath: string,
    options?: Options
): Promise<SetPackageRepoResult> {
    requireCliTools();
    const opts: Options = {
        ...defaultOptions,
        ...options
    };
    const
        raw = await readTextFile(packageJsonPath),
        indent = determineIndentFor(raw),
        pkgIndex = JSON.parse(raw) as PackageIndex,
        remote = await findOriginRemoteFor(packageJsonPath);

    if (remote === GitError.notInitialised) {
        return error(
            `${packageJsonPath} does not appear to be within an initialised git repository`
        );
    }

    if (remote === GitError.noRemotes) {
        return error(`no remotes have been set up for the repository containing '${packageJsonPath}'`);
    }

    const url = determineHttpsUrlFor(remote);

    let repoAlreadySet = false;
    if (pkgIndex.repository) {
        if (pkgIndex.repository.url !== url || pkgIndex.repository.type !== "git") {
            if (!opts.force) {
                return error(
                    `repository info is already set in '${packageJsonPath}' (${pkgIndex.repository}) - run with --force if to overwrite`
                );
            }
        } else {
            repoAlreadySet = true;
        }
    }

    let homepageAlreadySet = false;
    if (opts.homepage && pkgIndex.homepage) {
        if (pkgIndex.homepage === url) {
            homepageAlreadySet = true;
        } else {
            if (!opts.force) {
                return error(
                    `homepage is already set in '${packageJsonPath}' (${pkgIndex.homepage}) - run with --force to overwrite`
                );
            }
        }
    }

    if (opts.homepage) {
        pkgIndex.homepage = url;
    }

    if (opts.homepage && homepageAlreadySet && repoAlreadySet) {
        return success(`homepage and repo already set in '${packageJsonPath}'`);
    }

    pkgIndex.repository = {
        type: "git",
        url,
    };

    const toWrite = JSON.stringify(pkgIndex, null, indent);
    await writeTextFile(packageJsonPath, toWrite);

    let message: string | undefined = undefined;
    if (repoAlreadySet) {
        message = `repo already set in '${packageJsonPath}', homepage set to '${url}'`;
    } else if (homepageAlreadySet) {
        message = `homepage already set in '${packageJsonPath}', repo set to '${url}'`;
    }

    return success(message);
}

function determineIndentFor(json: string): number {
    const
        lines = json.split("\n").map(s => s.trimEnd()),
        line2 = lines[1],
        line2Trimmed = lines[1].trimStart();
    return line2.length - line2Trimmed.length;
}

function success(message?: string): SetPackageRepoResult {
    return {
        success: true,
        message
    };
}

function error(message: string): SetPackageRepoResult {
    return {
        success: false,
        message
    };
}

function determineHttpsUrlFor(remote: RemoteWithRefs): string {
    const raw = remote.refs.push || remote.refs.fetch;
    if (raw.startsWith("git@github.com:")) {
        return convertGitHubSshUrlToHttps(raw);
    }
    return raw;
}

function convertGitHubSshUrlToHttps(url: string): string {
    return url.replace(/^git@/, "https://")
        .replace("github.com:", "github.com/")
        .replace(/\.git$/, "");
}

async function findOriginRemoteFor(
    packageJsonPath: string
): Promise<RemoteWithRefs | GitError> {
    try {
        const
            git = simpleGit(path.dirname(packageJsonPath)),
            remotes = await git.getRemotes(true);
        if (remotes.length === 0) {
            return GitError.noRemotes;
        }

        const origin = remotes.find(r => r.name === "origin");
        return origin || remotes[0];
    } catch (e) {
        return GitError.notInitialised;
    }
}

// I don't want to clutter exports with these
// TODO: newts should be updated to understand
//       files which should not be exported via the index
function requireCliTools(): void {
    verifyHaveTool("npm");
    verifyHaveTool("git");
}

function verifyHaveTool(name: string): void {
    const found = which.sync(name, { nothrow: true });
    if (!found) {
        throw new Error(`Required commandline tool not found in environment: ${name}`);
    }
}

interface PackageIndex {
    name: string;
    version: string;
    description?: string;
    bin?: Dictionary<string>;
    homepage?: string;
    main?: string;
    scripts?: Dictionary<string>;
    dependencies?: Dictionary<string>;
    devDependencies?: Dictionary<string>;
    files?: string[];
    author: Author; // I'm sure there's a multi-author construct too
    license: string;
    repository?: {
        type: string;
        url: string;
    };
}

interface Dictionary<TValue> {
    [key: string]: TValue;
}

interface Author {
    name: string;
    url: string;
}
