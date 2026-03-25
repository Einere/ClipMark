#!/usr/bin/env node

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_INPUT = "src-tauri/icons/base/base-icon.svg";
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const parseArgs = (argv) => {
  const options = {
    input: DEFAULT_INPUT,
    output: "app-icon.png",
    size: 1024,
    chromePath: process.env.CHROME_PATH || DEFAULT_CHROME_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--size") {
      options.size = Number.parseInt(argv[index + 1] ?? "", 10);
      index += 1;
      continue;
    }

    if (arg === "--chrome") {
      options.chromePath = argv[index + 1] ?? options.chromePath;
      index += 1;
      continue;
    }

    if (!options._inputSet) {
      options.input = arg;
      options._inputSet = true;
      continue;
    }

    if (!options.output) {
      options.output = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.size) || options.size <= 0) {
    throw new Error("--size must be a positive integer");
  }

  delete options._inputSet;
  return options;
};

const getOutputPath = (inputPath, outputPath) => {
  if (outputPath) {
    return path.resolve(outputPath);
  }

  const parsed = path.parse(path.resolve(inputPath));
  return path.join(parsed.dir, `${parsed.name}.png`);
};

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const waitForFile = async (filePath, timeoutMs = 5000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await access(filePath, fsConstants.F_OK);
      return;
    } catch {
      await wait(50);
    }
  }

  throw new Error(`Timed out waiting for ${filePath}`);
};

const launchChrome = async (chromePath, userDataDir) => {
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const activePortPath = path.join(userDataDir, "DevToolsActivePort");
  await waitForFile(activePortPath);
  const portFile = await readFile(activePortPath, "utf8");
  const [port, browserPath] = portFile.trim().split("\n");

  if (!port || !browserPath) {
    chrome.kill("SIGKILL");
    throw new Error("Failed to read DevToolsActivePort");
  }

  return {
    chrome,
    stderr,
    webSocketUrl: `ws://127.0.0.1:${port}${browserPath}`,
  };
};

const createCdpClient = async (webSocketUrl) => {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;
  let attachedSessionId = null;

  const open = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data.toString());

    if (payload.id) {
      const callbacks = pending.get(payload.id);
      if (!callbacks) {
        return;
      }

      pending.delete(payload.id);
      if (payload.error) {
        callbacks.reject(new Error(payload.error.message));
        return;
      }

      callbacks.resolve(payload.result);
      return;
    }

    if (payload.method === "Target.attachedToTarget") {
      attachedSessionId = payload.params.sessionId;
    }

    if (payload.method) {
      const callbacks = listeners.get(payload.method) ?? [];
      for (const callback of callbacks) {
        callback(payload.params, payload.sessionId);
      }
    }
  });

  await open;

  const send = (method, params = {}, sessionId = attachedSessionId) => new Promise((resolve, reject) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({
      id,
      method,
      params,
      ...(sessionId ? { sessionId } : {}),
    }));
  });

  return {
    async attachPageTarget() {
      const { targetId } = await send("Target.createTarget", { url: "about:blank" }, null);
      await send("Target.attachToTarget", { targetId, flatten: true }, null);

      const startedAt = Date.now();
      while (!attachedSessionId && Date.now() - startedAt < 2000) {
        await wait(10);
      }

      if (!attachedSessionId) {
        throw new Error("Failed to attach to page target");
      }

      return attachedSessionId;
    },
    send,
    once(method, predicate = () => true, timeoutMs = 5000) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timed out waiting for ${method}`));
        }, timeoutMs);

        const callback = (params, sessionId) => {
          if (!predicate(params, sessionId)) {
            return;
          }

          clearTimeout(timeout);
          const queue = listeners.get(method) ?? [];
          listeners.set(method, queue.filter((entry) => entry !== callback));
          resolve({ params, sessionId });
        };

        const queue = listeners.get(method) ?? [];
        queue.push(callback);
        listeners.set(method, queue);
      });
    },
    close() {
      socket.close();
    },
  };
};

const createHtml = (svgMarkup, size) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body {
        margin: 0;
        width: ${size}px;
        height: ${size}px;
        overflow: hidden;
        background: transparent;
      }

      body {
        display: grid;
        place-items: center;
      }

      svg {
        display: block;
        width: ${size}px;
        height: ${size}px;
      }
    </style>
  </head>
  <body>
    ${svgMarkup}
  </body>
</html>`;

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const outputPath = getOutputPath(inputPath, args.output);
  const userDataDir = await mkdtemp(path.join(tmpdir(), "clipmark-icon-cdp-"));

  try {
    const svgMarkup = await readFile(inputPath, "utf8");
    const html = createHtml(svgMarkup, args.size);
    const pageUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    const { chrome, webSocketUrl } = await launchChrome(args.chromePath, userDataDir);
    const cdp = await createCdpClient(webSocketUrl);

    try {
      await cdp.attachPageTarget();
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: args.size,
        height: args.size,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send("Emulation.setDefaultBackgroundColorOverride", {
        color: { r: 0, g: 0, b: 0, a: 0 },
      });

      await cdp.send("Page.navigate", { url: pageUrl });
      await cdp.once("Page.loadEventFired");
      await wait(150);

      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });

      await writeFile(outputPath, Buffer.from(data, "base64"));
      console.log(`Saved ${path.relative(process.cwd(), outputPath)}`);
    } finally {
      cdp.close();
      chrome.kill("SIGKILL");
    }
  } finally {
    await rm(userDataDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
