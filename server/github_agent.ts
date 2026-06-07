import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import ts from "typescript";

const PROTECTED_PATTERNS = [
  /calculateSMC|detectBOS|detectCHOCH|detectFVG|detectOrderBlock/,
  /getMarketBias|marketBias/,
  /timezone.*Asia\/Makassar|WITA/,
  /failover.*TwelveData.*Yahoo/,
  /risk.*pip|stopLoss|takeProfit/
];

export async function validateLogic(filePath: string, newContent: string) {
  let currentContent = "";
  const actualFilePath = path.join(process.cwd(), filePath);
  try {
    if (fs.existsSync(actualFilePath)) {
      currentContent = fs.readFileSync(actualFilePath, "utf-8");
    }
  } catch (err) {
    // Ignore read errors
  }

  const hasProtected = PROTECTED_PATTERNS.some((p) => p.test(currentContent));

  if (hasProtected && (filePath.endsWith(".ts") || filePath.endsWith(".tsx"))) {
    const sourceFile = ts.createSourceFile(filePath, newContent, ts.ScriptTarget.Latest, true);
    const foundFunctions = new Set<string>();

    function visit(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        foundFunctions.add(node.name.text);
      } else if (
        ts.isVariableDeclaration(node) &&
        node.name &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        foundFunctions.add(node.name.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    const oldSourceFile = ts.createSourceFile(filePath, currentContent, ts.ScriptTarget.Latest, true);
    const oldFunctions = new Set<string>();

    function visitOld(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        oldFunctions.add(node.name.text);
      } else if (
        ts.isVariableDeclaration(node) &&
        node.name &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        oldFunctions.add(node.name.text);
      }
      ts.forEachChild(node, visitOld);
    }
    visitOld(oldSourceFile);

    const smcFuncs = [
      "calculateSMC",
      "detectBOS",
      "detectCHOCH",
      "detectFVG",
      "detectOrderBlock",
      "getMarketBias",
      "marketBias",
    ];

    for (const func of smcFuncs) {
      if (oldFunctions.has(func) && !foundFunctions.has(func)) {
        throw new Error(`Cannot modify core SMC logic: ${func} is missing`);
      }
    }

    if (currentContent.includes("Asia/Makassar") && !newContent.includes("Asia/Makassar")) {
      throw new Error("Cannot modify core SMC logic: Asia/Makassar timezone is missing");
    }
  }
}

export async function autoCommitToMain({
  file,
  newContent,
  commitMessage,
  strategy_context,
}: {
  file: string;
  newContent: string;
  commitMessage: string;
  strategy_context?: string;
}) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    throw new Error("GitHub credentials not fully configured (GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME)");
  }

  const octokit = new Octokit({ auth: token });
  const git = simpleGit(); // Included as per requirement

  let fileSha: string | undefined;
  let baseSha: string | undefined;

  try {
    const { data: refData } = await octokit.rest.git
      .getRef({ owner, repo, ref: "heads/main" })
      .catch(async () => await octokit.rest.git.getRef({ owner, repo, ref: "heads/master" }));
    baseSha = refData.object.sha;

    const { data: fileData } = await octokit.rest.repos.getContent({ owner, repo, path: file, ref: "heads/main" });
    if (!Array.isArray(fileData) && fileData.type === "file") {
      fileSha = fileData.sha;
    }
  } catch (e) {
    // File may not exist yet
  }

  await validateLogic(file, newContent);

  if (baseSha) {
    fs.writeFileSync("/tmp/backup_sha.txt", baseSha, "utf-8");
  }

  const actualFilePath = path.join(process.cwd(), file);
  const fileExisted = fs.existsSync(actualFilePath);
  let originalContent = "";
  if (fileExisted) {
    originalContent = fs.readFileSync(actualFilePath, "utf-8");
  }
  
  // ensure directory exists
  fs.mkdirSync(path.dirname(actualFilePath), { recursive: true });
  fs.writeFileSync(actualFilePath, newContent);

  try {
    execSync("npx tsc --noEmit", { stdio: "pipe" });
  } catch (err: any) {
    if (fileExisted) {
      fs.writeFileSync(actualFilePath, originalContent);
    } else {
      fs.unlinkSync(actualFilePath);
    }
    throw new Error("TS check failed: " + err.message + "\n" + (err.stdout ? err.stdout.toString() : ""));
  }

  if (fileExisted) {
    fs.writeFileSync(actualFilePath, originalContent);
  } else {
    fs.unlinkSync(actualFilePath);
  }

  const commitRes = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: file,
    message: commitMessage,
    content: Buffer.from(newContent).toString("base64"),
    sha: fileSha,
    branch: "main",
  });

  return {
    commit_url: commitRes.data.commit.html_url,
    backup_sha: baseSha,
    after_sha: commitRes.data.commit.sha,
  };
}

export async function deleteFileFromMain({
  file,
  commitMessage,
}: {
  file: string;
  commitMessage: string;
}) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    throw new Error("GitHub credentials not fully configured");
  }

  const octokit = new Octokit({ auth: token });

  let fileSha: string | undefined;
  let baseSha: string | undefined;

  try {
    const { data: refData } = await octokit.rest.git
      .getRef({ owner, repo, ref: "heads/main" })
      .catch(async () => await octokit.rest.git.getRef({ owner, repo, ref: "heads/master" }));
    baseSha = refData.object.sha;

    const { data: fileData } = await octokit.rest.repos.getContent({ owner, repo, path: file, ref: "heads/main" });
    if (!Array.isArray(fileData) && fileData.type === "file") {
      fileSha = fileData.sha;
    } else {
      throw new Error("File not found to delete");
    }
  } catch (err: any) {
    throw new Error("Failed to load file information from GitHub: " + err.message);
  }

  let currentContent = "";
  const actualFilePath = path.join(process.cwd(), file);
  try {
    if (fs.existsSync(actualFilePath)) {
      currentContent = fs.readFileSync(actualFilePath, "utf-8");
    }
  } catch (e) {}

  const hasProtected = PROTECTED_PATTERNS.some((p) => p.test(currentContent));
  if (hasProtected && (file.endsWith(".ts") || file.endsWith(".tsx"))) {
    throw new Error("Cannot modify core SMC logic: Refusing to delete protected file");
  }

  if (baseSha) {
    fs.writeFileSync("/tmp/backup_sha.txt", baseSha, "utf-8");
  }

  const commitRes = await octokit.rest.repos.deleteFile({
    owner,
    repo,
    path: file,
    message: commitMessage,
    sha: fileSha,
    branch: "main",
  });

  return {
    commit_url: commitRes.data.commit.html_url,
    backup_sha: baseSha,
    after_sha: commitRes.data.commit.sha,
  };
}

export async function rollbackToBackup() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    throw new Error("GitHub credentials not fully configured");
  }

  if (!fs.existsSync("/tmp/backup_sha.txt")) {
    throw new Error("No backup_sha found");
  }
  const backup_sha = fs.readFileSync("/tmp/backup_sha.txt", "utf-8").trim();

  const octokit = new Octokit({ auth: token });

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: "heads/main",
    sha: backup_sha,
    force: true,
  });

  return { status: "rolled back", commit: backup_sha };
}
