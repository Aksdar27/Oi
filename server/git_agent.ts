import { execSync } from "child_process";

export class GitAgent {
  private token: string;
  private owner: string;
  private repo: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || "";
    this.owner = process.env.GITHUB_REPO_OWNER || "";
    this.repo = process.env.GITHUB_REPO_NAME || "";

    if (!this.token) {
        console.warn("[GitAgent] WARNING: GITHUB_TOKEN is not set in environment variables. Remote git operations may fail.");
    }
  }

  private configureGit() {
    if (!this.token || !this.owner || !this.repo) {
       console.warn("[GitAgent] Missing GITHUB_TOKEN, GITHUB_REPO_OWNER, or GITHUB_REPO_NAME. Push might fail.");
       return false;
    }
    try {
      execSync('git config --global user.name "AI Agent"');
      execSync('git config --global user.email "bot@xauusd.ai"');
      
      const remoteUrl = `https://${this.token}@github.com/${this.owner}/${this.repo}.git`;
      // Check if remote exists, update it, or add it
      try {
        execSync(`git remote set-url origin ${remoteUrl}`);
      } catch {
        execSync(`git remote add origin ${remoteUrl}`);
      }
      return true;
    } catch (err: any) {
      console.error("[GitAgent] Failed to configure Git:", err.message);
      return false;
    }
  }

  commitAll(message: string) {
    if (!this.token) throw new Error("GITHUB_TOKEN not found");
    try {
      this.configureGit();

      execSync("git add .", { stdio: "pipe" });
      const status = execSync("git status --porcelain").toString();
      if (!status) {
         return { success: true, message: "No changes to commit", commit_sha: this.getLastCommit() };
      }
      execSync(`git commit -m "${message}"`, { stdio: "pipe" });
      execSync("git push origin main", { stdio: "pipe" });
      const sha = this.getLastCommit();
      return { success: true, commit_sha: sha, github_url: `https://github.com/${this.owner}/${this.repo}/commit/${sha}` };
    } catch (err: any) {
      throw new Error(`Git commit failed: ${err.message}`);
    }
  }

  rollbackTo(sha: string) {
    if (!this.token) throw new Error("GITHUB_TOKEN not found");
    try {
      this.configureGit();
      
      execSync(`git reset --hard ${sha}`, { stdio: "pipe" });
      execSync("git push --force origin main", { stdio: "pipe" });
      return { success: true, status: "rolled back", commit: sha };
    } catch (err: any) {
      throw new Error(`Git rollback failed: ${err.message}`);
    }
  }

  getLastCommit(): string {
    try {
      return execSync("git rev-parse HEAD").toString().trim();
    } catch (err) {
      return "unknown_sha";
    }
  }
}

export const gitAgent = new GitAgent();
