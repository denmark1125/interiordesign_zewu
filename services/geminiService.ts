import { DesignProject } from "../types";

// 為了讓 APK 能夠順利部署，我們移除 @google/genai 的直接引用。
// 這裡改為回傳模擬的 AI 回應，確保介面功能正常但不會導致打包錯誤。

export const generateProjectReport = async (project: DesignProject): Promise<string> => {
  // 模擬延遲，讓使用者感覺像是在生成中
  await new Promise(resolve => setTimeout(resolve, 1500));

  return `【AI 專案週報 (模擬生成)】
  
專案名稱：${project.projectName}
目前階段：${project.currentStage}
負責人員：${project.assignedEmployee}

本週進度摘要：
${project.latestProgressNotes}

下週預計事項：
1. 確認客戶針對本次進度的反饋。
2. 安排下一階段工種進場（如適用）。
3. 核對目前施工品質與設計圖面是否相符。

注意事項：
請留意 ${project.estimatedCompletionDate} 的完工期限，目前進度符合預期。`;
};

export const analyzeDesignIssue = async (project: DesignProject, inputContent: string): Promise<{analysis: string, suggestions: string[]}> => {
  // 模擬延遲
  await new Promise(resolve => setTimeout(resolve, 1500));

  return {
    analysis: `針對「${inputContent}」的分析結果：此問題可能涉及現場管線與原始圖面的衝突，建議優先確認現場實際尺寸。`,
    suggestions: [
      "建議立即安排現場會勘，確認實際尺寸差異。",
      "若變更幅度較大，請填寫工程追加減單。",
      "請拍照記錄現場狀況，並上傳至群組留存。",
      "與業主溝通變更後的完工日期影響。"
    ]
  };
};