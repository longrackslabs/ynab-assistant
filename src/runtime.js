export function requireSupportedNode(version = process.versions.node) {
  const major = Number(version.split('.')[0]);
  if (!Number.isInteger(major) || major < 22) {
    throw new Error(`YNAB Assistant requires Node.js 22 or newer; running ${version}. Select a supported Node runtime before running npm commands.`);
  }
}
