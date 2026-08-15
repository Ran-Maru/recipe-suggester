import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(0, "utf8"));
const command = String(input.command ?? "");

const rules = [
  {
    re: /(^|[;&|]\s*)sudo(\s|$)/,
    message: "Blocked: sudo",
  },
  {
    re: /git\s+push\b[^\n]*--force/,
    message: "Blocked: git push --force",
  },
  {
    re: /git\s+push\b[^\n]*\s-f(\s|$)/,
    message: "Blocked: git push -f",
  },
  {
    re: /rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(\/|~\/|~(\s|$)|\$HOME|\/Users\/|\/home\/|\/etc\/|\/usr\/|\/var\/|\/System\/)/,
    message: "Blocked: recursive rm of a system path",
  },
  {
    re: /chmod\s+-R\s/,
    message: "Blocked: chmod -R",
  },
  {
    re: /\bmkfs\./,
    message: "Blocked: mkfs",
  },
  {
    re: /\bdd\s+if=/,
    message: "Blocked: dd",
  },
  {
    re: /security\s+dump-keychain/,
    message: "Blocked: security dump-keychain",
  },
];

const denied = rules.find((rule) => rule.re.test(command));
if (denied) {
  process.stdout.write(
    JSON.stringify({
      permission: "deny",
      user_message: denied.message,
      agent_message: denied.message,
    }),
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({ permission: "allow" }));
