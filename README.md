set-package-repo
---

Have you ever forgotten to set the repo information (and/or homepage) in your package.json?

I have. And personally, I don't trust npm packages when I can't get to the original source,
especially when most have gone through some kind of build step / minification.


So I wrote this little tool (which can also be used as a library):

### Command-line usage

```bash
npx -y set-package-repo /path/to/package.json
```

If nothing has been set, your repo url gleaned from git should be used, and your homepage set, eg:
```json
    "repository": {
        "type": "git",
        "url": "https://github.com/your-name/your-package"
    },
    "homepage": "https://github.com/your-name/your-package"
```

Ff you'd like to skip setting the homepage, use `--no-homepage` (required if the repo information
is not set, but the homepage is set, and is different from the repo url).

If you'd like to force the tool to make the changes, even though the repo url and homepage are set,
run with `--force`


### Library usage

I'm not sure why you'd want to use it as a library, but you can:

```typescript
import { setPackageRepo } from "set-package-repo";

await setPackageRepo("/path/to/package.json");
// or, with options:
await setPackageRepo(
    "/path/to/package.json", {
        force: true,
        homepage: false
    }
);
```
