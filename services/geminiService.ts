
import { DesignProject, AIAnalysisResult } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

export const generateProjectReport = async (project: DesignProject): Promise<string> => {
  // 延遲初始化以避免啟動錯誤
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "AI 無法生成報告內容。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成週報時發生錯誤，請稍後再試。";
  }
};

export const analyzeDesignIssue = async (project: DesignProject, inputContent: string): Promise<AIAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
  針對以下室內設計專案問題進行分析與建議：
  專案：${project.projectName} (${project.currentStage})
  問題：${inputContent}
  `;

  try {
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
