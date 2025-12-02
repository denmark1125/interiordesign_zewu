import { DesignProject } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Hardcode the key as fallback to ensure APK functionality works
// This solves the issue where process.env might be undefined on mobile devices
const API_KEY = process.env.API_KEY || "AIzaSyD5y1wnTV3bsZ85Dg-PO3TGcHWADQem7Rk";

let aiClient: GoogleGenAI | null = null;

// Lazy initialization function
// This ensures we don't crash the app on startup if the key is missing
const getAIClient = (): GoogleGenAI => {
  if (!aiClient) {
    if (!API_KEY) {
      throw new Error("API Key is missing");
    }
    aiClient = new GoogleGenAI({ apiKey: API_KEY });
  }
  return aiClient;
};

export const generateProjectReport = async (project: DesignProject): Promise<string> => {
  const prompt = `
  請為以下室內設計專案撰寫一份專業的週報：
  
  專案名稱：${project.projectName}
  目前階段：${project.currentStage}
  負責人員：${project.assignedEmployee}
  
  本週最新進度：
  ${project.latestProgressNotes}

  客戶需求：
  ${project.clientRequests}

  內部備註：
  ${project.internalNotes}

  請包含：
  1. 本週進度摘要
  2. 下週預計事項
  3. 注意事項 (基於客戶需求與內部備註)
  
  語氣請專業、簡潔。`;

  try {
    // Initialize client only when this function is called
    const ai = getAIClient();
    
    // Use gemini-2.5-flash for basic text tasks (Stable model)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "AI 無法生成報告內容。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成週報時發生錯誤，請稍後再試。";
  }
};

export const analyzeDesignIssue = async (project: DesignProject, inputContent: string): Promise<{analysis: string, suggestions: string[]}> => {
  const prompt = `
  針對以下室內設計專案問題進行分析與建議：
  專案：${project.projectName} (${project.currentStage})
  問題：${inputContent}
  `;

  try {
    // Initialize client only when this function is called
    const ai = getAIClient();

    // Use gemini-2.5-flash for stability (switched from pro-preview)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            suggestions: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["analysis", "suggestions"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      analysis: "目前無法進行 AI 分析，請稍後再試。",
      suggestions: ["建議諮詢專業技師", "確認現場施工圖面", "與業主討論替代方案"]
    };
  }
};