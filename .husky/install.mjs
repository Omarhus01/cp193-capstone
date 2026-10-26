// The root `prepare` script: installs the git hooks after `npm install`.
// It never fails an install. An install run inside apps/web (Vercel's default)
// leaves out the root devDependencies, husky included, but npm still runs this
// script (docs/deploy.md, section 8).
if (process.env.VERCEL || process.env.CI) process.exit(0);

let husky;
try {
  husky = (await import("husky")).default;
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  console.log(
    "husky isn't installed, so the git hooks weren't set up. Run npm install at the repository root.",
  );
  process.exit(0);
}

const message = husky();
if (message) console.log(message);
