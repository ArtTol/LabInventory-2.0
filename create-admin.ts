
import bcrypt from "bcryptjs";

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error("Run this script in an interactive terminal.");
  }

  process.stdout.write("Enter new admin password (hidden): ");

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  let password = "";

  await new Promise<void>((resolve, reject) => {
    stdin.on("data", (key: string) => {
      if (key === "\u0003") {
        reject(new Error("Cancelled"));
        return;
      }

      if (key === "\r" || key === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write("\n");
        resolve();
        return;
      }

      if (key === "\u007f" || key === "\b") {
        password = password.slice(0, -1);
        return;
      }

      password += key;
    });
  });

  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  const hash = await bcrypt.hash(password, 12);
  password = "";

  console.log("\nBcrypt hash:");
  console.log(hash);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
