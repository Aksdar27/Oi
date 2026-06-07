import fs from "fs";
import path from "path";

const MEMORY_FILE = path.join(process.cwd(), "data", "ai_memory.json");

export interface AIMemory {
  project_rules: string[];
  code_style: string[];
  past_decisions: string[];
  user_preferences: string[];
}

export class MemoryManager {
  private memory: AIMemory = {
    project_rules: [],
    code_style: [],
    past_decisions: [],
    user_preferences: []
  };

  constructor() {
    this.loadMemory();
  }

  loadMemory() {
    try {
      const dataDir = path.dirname(MEMORY_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      if (fs.existsSync(MEMORY_FILE)) {
        const rawData = fs.readFileSync(MEMORY_FILE, "utf-8");
        this.memory = JSON.parse(rawData);
      } else {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.memory, null, 2), "utf-8");
      }
    } catch (err) {
      console.error("[MemoryManager] Error loading memory:", err);
    }
  }

  getMemory<K extends keyof AIMemory>(type: K): AIMemory[K] {
    return this.memory[type];
  }
  
  getAllMemory(): AIMemory {
    return this.memory;
  }

  saveMemory<K extends keyof AIMemory>(type: K, data: string) {
    this.memory[type].push(data);
    try {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.memory, null, 2), "utf-8");
    } catch (err) {
      console.error("[MemoryManager] Error saving memory:", err);
    }
  }
}

export const memoryManager = new MemoryManager();
