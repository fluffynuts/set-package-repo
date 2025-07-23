import "expect-even-more-jest";
import { faker } from "@faker-js/faker";
import { Sandbox } from "filesystem-sandbox";
import { exists, readTextFile, writeTextFile } from "yafs";
import { setPackageRepo } from "../src";
import which from "which";
import { ctx } from "exec-step";

describe(`set-package-repo`, () => {
    const { spyOn } = jest;
    const { stringContaining } = expect;
    beforeAll(() => {
        requireCliTool("npm");
        requireCliTool("git");
        spyOn(ctx, "exec").mockImplementation(
            async (_: string, fn: () => any) => {
                return await fn();
            });
    });

    it(`should set the current repository info when missing`, async () => {
        // Arrange
        const
            expected = randomUrl(),
            sandbox = await Sandbox.create();

        await sandbox.exec("npm", [ "init", "-y" ]);
        await sandbox.exec("git", [ "init" ]);
        await sandbox.exec("git", [ "remote", "add", "origin", expected ]);

        const packageJsonPath = sandbox.fullPathFor("package.json");

        const expectedEntries = [
            packageJsonPath,
            sandbox.fullPathFor(".git")
        ];
        for (const entry of expectedEntries) {
            expect(await exists(entry))
                .toBeTrue();
        }

        // Act
        const result = await setPackageRepo(packageJsonPath);

        // Assert
        expect(result.success)
            .toBeTrue();
        const
            raw = await readTextFile(packageJsonPath),
            parsed = JSON.parse(raw) as PackageIndex;

        expect(parsed.repository)
            .toExist();
        expect(parsed.repository!.type)
            .toEqual("git");
        expect(parsed.repository!.url)
            .toEqual(expected);
    });

    it(`should set the current repository as https when ssh remote added`, async () => {
        // Arrange
        const
            sshRemote = "git@github.com:foo/bar.git",
            expected = "https://github.com/foo/bar",
            sandbox = await Sandbox.create();

        await sandbox.exec("npm", [ "init", "-y" ]);
        await sandbox.exec("git", [ "init" ]);
        await sandbox.exec("git", [ "remote", "add", "origin", sshRemote ]);

        const packageJsonPath = sandbox.fullPathFor("package.json");

        const expectedEntries = [
            packageJsonPath,
            sandbox.fullPathFor(".git")
        ];
        for (const entry of expectedEntries) {
            expect(await exists(entry))
                .toBeTrue();
        }

        // Act
        const result = await setPackageRepo(packageJsonPath);

        // Assert
        expect(result.success)
            .toBeTrue();
        const
            raw = await readTextFile(packageJsonPath),
            parsed = JSON.parse(raw) as PackageIndex;

        expect(parsed.repository)
            .toExist();
        expect(parsed.repository!.type)
            .toEqual("git");
        expect(parsed.repository!.url)
            .toEqual(expected);
    });

    it(`should return success when all already set`, async () => {
        // Arrange
        const sandbox = await Sandbox.create();

        await sandbox.exec("npm", [ "init", "-y" ]);
        await sandbox.exec("git", [ "init" ]);
        await sandbox.exec("git", [ "remote", "add", "origin", randomUrl() ]);

        const packageJsonPath = sandbox.fullPathFor("package.json");

        // Act
        await setPackageRepo(packageJsonPath);
        const result = await setPackageRepo(packageJsonPath);

        // Assert
        expect(result.success)
            .toBeTrue();
        expect(result.message)
            .toEqual(
                stringContaining(
                    "already set"
                )
            );
    });

    describe(`when not forced`, () => {
        it(`should fail when repo is already set differently`, async () => {
            // Arrange
            const sandbox = await Sandbox.create();

            await sandbox.exec("npm", [ "init", "-y" ]);
            await sandbox.exec("git", [ "init" ]);
            await sandbox.exec("git", [ "remote", "add", "origin", randomUrl() ]);

            const
                packageJsonPath = sandbox.fullPathFor("package.json"),
                raw = await readTextFile(packageJsonPath),
                pkgIndex = JSON.parse(raw) as PackageIndex;

            pkgIndex.repository = {
                type: "git",
                url: randomUrl()
            };
            await writeTextFile(packageJsonPath, JSON.stringify(pkgIndex, null, 2));

            // Act
            const result = await setPackageRepo(packageJsonPath);
            // Assert
            expect(result.success)
                .toBeFalse();
            expect(result.message)
                .toEqual(
                    stringContaining(
                        "--force"
                    )
                );
            const
                currentContents = await readTextFile(packageJsonPath),
                currentPkgIndex = JSON.parse(currentContents) as PackageIndex;
            expect(currentPkgIndex)
                .toEqual(pkgIndex);

        });

        it(`should fail when homepage already set differently`, async () => {
            // Arrange
            // Arrange
            const sandbox = await Sandbox.create();

            await sandbox.exec("npm", [ "init", "-y" ]);
            await sandbox.exec("git", [ "init" ]);
            await sandbox.exec("git", [ "remote", "add", "origin", randomUrl() ]);

            const
                packageJsonPath = sandbox.fullPathFor("package.json"),
                raw = await readTextFile(packageJsonPath),
                pkgIndex = JSON.parse(raw) as PackageIndex;

            pkgIndex.homepage = randomUrl();
            await writeTextFile(packageJsonPath, JSON.stringify(pkgIndex, null, 2));

            // Act
            const result = await setPackageRepo(packageJsonPath);
            // Assert
            expect(result.success)
                .toBeFalse();
            expect(result.message)
                .toEqual(
                    stringContaining(
                        "--force"
                    )
                );
        });

    });
    describe(`when forced`, () => {
        it(`should overwrite repo`, async () => {
            // Arrange
            const
                expected = randomUrl(),
                sandbox = await Sandbox.create();

            await sandbox.exec("npm", [ "init", "-y" ]);
            await sandbox.exec("git", [ "init" ]);
            await sandbox.exec("git", [ "remote", "add", "origin", expected ]);

            const
                packageJsonPath = sandbox.fullPathFor("package.json"),
                raw = await readTextFile(packageJsonPath),
                pkgIndex = JSON.parse(raw) as PackageIndex;

            pkgIndex.repository = {
                type: "git",
                url: randomUrl()
            };
            await writeTextFile(packageJsonPath, JSON.stringify(pkgIndex, null, 2));

            // Act
            const result = await setPackageRepo(
                packageJsonPath,
                { force: true }
            );
            // Assert
            expect(result.success)
                .toBeTrue();
            const
                currentContents = await readTextFile(packageJsonPath),
                currentPkgIndex = JSON.parse(currentContents) as PackageIndex;
            expect(currentPkgIndex.repository)
                .toEqual({
                    type: "git",
                    url: expected
                });

        });

        it(`should overwrite the homepage`, async () => {
            // Arrange
            const
                expected = randomUrl(),
                sandbox = await Sandbox.create();

            await sandbox.exec("npm", [ "init", "-y" ]);
            await sandbox.exec("git", [ "init" ]);
            await sandbox.exec("git", [ "remote", "add", "origin", expected ]);

            const
                packageJsonPath = sandbox.fullPathFor("package.json"),
                raw = await readTextFile(packageJsonPath),
                pkgIndex = JSON.parse(raw) as PackageIndex;

            pkgIndex.homepage = randomUrl();
            await writeTextFile(
                packageJsonPath,
                JSON.stringify(pkgIndex, null, 2)
            );

            // Act
            const result = await setPackageRepo(
                packageJsonPath, { force: true }
            );
            // Assert
            expect(result.success)
                .toBeTrue();
            const
                currentContents = await readTextFile(packageJsonPath),
                currentPkgIndex = JSON.parse(currentContents) as PackageIndex;
            expect(currentPkgIndex.homepage)
                .toEqual(expected);
        });

    });

    describe(`when homepage is disabled in options`, () => {
        it(`should not set the homepage`, async () => {
            // Arrange
            const
                expected = randomUrl(),
                sandbox = await Sandbox.create(),
                packageJsonPath = sandbox.fullPathFor("package.json");

            await sandbox.exec("npm", [ "init", "-y" ]);
            await sandbox.exec("git", [ "init" ]);
            await sandbox.exec("git", [ "remote", "add", "origin", expected ]);

            // Act
            const result = await setPackageRepo(packageJsonPath, { homepage: false });
            // Assert
            expect(result.success)
                .toBeTrue();
            const
                currentContents = await readTextFile(packageJsonPath),
                currentPkgIndex = JSON.parse(currentContents) as PackageIndex;
            expect(currentPkgIndex.homepage)
                .toBeUndefined();
        });

        it(`should not overwrite the homepage`, async () => {
            // Arrange
            const
                sandbox = await Sandbox.create(),
                packageJsonPath = sandbox.fullPathFor("package.json");

            await sandbox.exec("npm", [ "init", "-y" ]);
            await sandbox.exec("git", [ "init" ]);
            await sandbox.exec("git", [ "remote", "add", "origin", randomUrl() ]);

            const
                raw = await readTextFile(packageJsonPath),
                pkgIndex = JSON.parse(raw) as PackageIndex,
                expected = randomUrl();
            pkgIndex.homepage = expected;
            await writeTextFile(
                packageJsonPath,
                JSON.stringify(pkgIndex, null, 2)
            );

            // Act
            const result = await setPackageRepo(packageJsonPath, { homepage: false });
            // Assert
            expect(result.success)
                .toBeTrue();
            const
                currentContents = await readTextFile(packageJsonPath),
                currentPkgIndex = JSON.parse(currentContents) as PackageIndex;
            expect(currentPkgIndex.homepage)
                .toEqual(expected);
        });
    });

    const seenUrls = new Set<string>();

    function randomUrl() {
        let result = "";
        do {
            result = faker.internet.url();
        } while (seenUrls.has(result));
        seenUrls.add(result);
        return result;
    }

    afterEach(async () => {
        await Sandbox.destroyAll();
    });

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

    function requireCliTool(name: string): void {
        verifyHaveTool("npm");
        verifyHaveTool("git");
    }

    function verifyHaveTool(name: string): void {
        const found = which.sync(name, { nothrow: true });
        if (!found) {
            throw new Error(`Required commandline tool not found in environment: ${name}`);
        }
    }

});
