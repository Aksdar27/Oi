import axios from "axios";
import { addSystemError } from "./engine.js";

export async function checkNewsBlock(): Promise<{ isBlocked: boolean; reason: string }> {
  const newsApiKey = process.env.NEWSAPI_KEY;
  const gnewsApiKey = process.env.GNEWS_API_KEY;
  
  if (!newsApiKey && !gnewsApiKey) {
    console.log("No News API keys found, skipping news check.");
    return { isBlocked: false, reason: "No keys" };
  }

  const keywords = ["USD", "Federal Reserve", "Interest Rate", "FOMC", "CPI", "PPI", "NFP", "Gold"];
  
  let isBlocked = false;
  let reason = "";

  try {
    if (newsApiKey) {
      const q = keywords.join(" OR ");
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&apiKey=${newsApiKey}&pageSize=5`;
      const res = await axios.get(url);
      
      const articles = res.data.articles || [];
      const now = new Date();
      
      for (const article of articles) {
        const pubDate = new Date(article.publishedAt);
        const diffMinutes = Math.abs(now.getTime() - pubDate.getTime()) / (1000 * 60);
        // Block window: 15 mins before and after. Assuming fresh news here = active block.
        if (diffMinutes <= 15) {
          isBlocked = true;
          reason = `NEWS_BLOCK (NewsAPI): ${article.title}`;
          break;
        }
      }
    }
  } catch (err: any) {
    console.error("NewsAPI Error:", err?.message || String(err));
    addSystemError(`NewsAPI Error: ${err.message}`);
  }

  if (!isBlocked && gnewsApiKey) {
    try {
      const q = keywords.join(" OR ");
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&sortBy=publishedAt&apikey=${gnewsApiKey}&max=5`;
      const res = await axios.get(url);
      
      const articles = res.data.articles || [];
      const now = new Date();

      for (const article of articles) {
        const pubDate = new Date(article.publishedAt);
        const diffMinutes = Math.abs(now.getTime() - pubDate.getTime()) / (1000 * 60);
        if (diffMinutes <= 15) {
          isBlocked = true;
          reason = `NEWS_BLOCK (GNews): ${article.title}`;
          break;
        }
      }
    } catch (err: any) {
      if (err.response && err.response.status === 403) {
        console.log("GNews API key quota exhausted or unauthorized (403). Skipping GNews.");
      } else {
        console.error("GNews Error", err.message);
        addSystemError(`GNews Error: ${err.message}`);
      }
    }
  }

  return { isBlocked, reason };
}
