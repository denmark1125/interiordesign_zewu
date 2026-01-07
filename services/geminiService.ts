
import { DesignProject, AIAnalysisResult } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Fixed: Strictly initialized as per guidelines using process.env.API_KEY.
// Assume process.env.API_KEY is pre-configured and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateProjectReport = async (project: DesignProject): Promise<string> => {
  // PRIVACY UPDATE: Removed ${project.internalNotes} from the prompt.
  // Internal notes are strictly for internal use and must not appear in client-facing reports.
  const prompt = `
  請為以下室內設計專案撰寫一份專業的週報：
  
  專案名稱：${project.projectName}
  目前階段：${project.currentStage}
  負責人員：${project.assignedEmployee}
  
  本週最新進度：
  ${project.latestProgressNotes}

  客戶需求：
  ${project.clientRequests}

  請包含：
  1. 本週進度摘要
  2. 下週預計事項
  3. 注意事項 (基於客戶需求)
  
  語氣請專業、簡潔，適合直接提供給業主查看。不要提及任何內部成本或敏感資訊。`;

  try {
    // Fixed: Use 'gemini-3-flash-preview' for basic text tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Fixed: Use .text property instead of .text() method.
    return response.text || "AI 無法生成報告內容。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成週報時發生錯誤，請稍後再試。";
  }
};

export const analyzeDesignIssue = async (project: DesignProject, inputContent: string): Promise<AIAnalysisResult> => {
  const prompt = `
  針對以下室內設計專案問題進行分析與建議：
  專案：${project.projectName} (${project.currentStage})
  問題：${inputContent}
  `;

  try {
    // Fixed: Use 'gemini-3-pro-preview' for complex reasoning/analysis tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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

    // Fixed: Use .text property instead of .text() method.
    if (response.text) {
      return JSON.parse(response.text) as AIAnalysisResult;
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
