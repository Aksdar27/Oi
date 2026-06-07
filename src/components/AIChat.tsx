import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Copy, AlertTriangle, Cpu, Upload, X } from "lucide-react";
import { Card, cn } from "./ui";
import { apiFetch } from "../lib/api";

type Role = "user" | "model";
interface Message {
  role: Role;
  content: string;
  image?: string;
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", content: "Hari ini kau mau ngulik file mana? Aku siap bantu sebagai AI Architect XAUUSD.\n\nPunya error? Paste ke sini atau upload screenshot." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleAskAi = (e: any) => {
      if (e.detail) {
        setInput(e.detail);
        setTimeout(() => {
           const sendBtn = document.getElementById("ai-send-btn");
           if (sendBtn) sendBtn.click();
        }, 100);
      }
    };
    window.addEventListener("ask-ai", handleAskAi);
    return () => window.removeEventListener("ask-ai", handleAskAi);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;
    const userMsg = input;
    const imageToSend = selectedImage;
    setInput("");
    setSelectedImage(null);
    
    setMessages(prev => [...prev, { role: "user", content: userMsg, image: imageToSend || undefined }]);
    setLoading(true);

    try {
      const res = await apiFetch("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ 
          message: userMsg, 
          image_base64: imageToSend,
          session_id: "default" 
        })
      });
      
      if (res.success && res.response) {
        let fullResponse = res.response;
        setMessages(prev => [...prev, { role: "model", content: fullResponse }]);
      } else if (res.error) {
        setMessages(prev => [...prev, { role: "model", content: `API Error: ${res.error}\nFallback Info: ${res.fallback || ""}` }]);
      } else {
        setMessages(prev => [...prev, { role: "model", content: "Error: Could not connect to AI engine or unsupported operation." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "model", content: "Error: Failed to reach AI service securely." }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-brand-info" />
        <h2 className="text-xl font-bold tracking-tight text-brand-text">AI Architect / Mechanic</h2>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col p-0 border-brand-info/20 shadow-[0_0_15px_rgba(0,191,255,0.05)] bg-brand-bg relative">
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn(
              "flex w-full",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}>
              <div className={cn(
                "max-w-[90%] rounded-2xl p-3 text-sm",
                msg.role === "user" 
                  ? "bg-brand-info/10 text-brand-text rounded-br-none border border-brand-info/20" 
                  : "bg-brand-bg-sec border border-brand-border text-brand-text-sec flex flex-col gap-2 rounded-bl-none font-mono"
              )}>
                {msg.role === "model" && idx > 0 && (
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-brand-border/50">
                    <span className="text-xs font-mono text-brand-info">AI SYSTEM</span>
                    <button 
                      onClick={() => copyToClipboard(msg.content)}
                      className="text-brand-text-sec hover:text-brand-info transition-colors"
                      title="Copy Fix"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {msg.image && (
                  <img src={msg.image} alt="User Upload" className="max-w-[200px] rounded mb-2 border border-brand-border/50" />
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-brand-text">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start w-full">
               <div className="bg-brand-bg-sec border border-brand-border text-brand-text rounded-2xl rounded-bl-none p-3 text-sm flex items-center gap-2 font-mono">
                 <div className="w-2 h-2 bg-brand-info rounded-full animate-pulse" />
                 <span className="text-xs text-brand-text-sec">Analyzing internal structures...</span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedImage && (
          <div className="absolute bottom-[60px] left-4 p-2 bg-brand-bg-sec border border-brand-border rounded-lg flex items-center gap-2 z-10 shadow-lg">
            <span className="text-xs text-brand-text">Image attached</span>
            <img src={selectedImage} alt="Preview" className="h-8 rounded" />
            <button onClick={() => setSelectedImage(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-3 bg-brand-bg-sec border-t border-brand-border gap-2 flex items-center relative z-20">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-brand-text-sec hover:text-brand-info transition-colors bg-brand-bg rounded-lg border border-brand-border hover:border-brand-info/50"
            title="Upload Image"
          >
            <Upload className="w-4 h-4" />
          </button>
          
          <input
            type="text"
            className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:border-brand-info outline-none transition-colors"
            placeholder="Ask AI Architect or paste issue / path to fix..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            disabled={loading}
          />
          <button
            id="ai-send-btn"
            onClick={handleSend}
            disabled={loading || (!input.trim() && !selectedImage)}
            className="bg-brand-info text-brand-bg p-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:hover:brightness-100 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}
