// Viral Metadata Template Generator

import type { MarketingCopy, ViralityAnalysis } from '../types';

export const generateViralMetadataFromTemplate = (topic: string, aspectRatio: string): { marketingCopy: MarketingCopy; viralityAnalysis: ViralityAnalysis } => {
  // Generate viral title based on topic
  const title = generateViralTitle(topic);
  
  // Generate description based on topic
  const description = generateViralDescription(topic);
  
  // Generate relevant tags
  const tags = generateViralTags(topic);
  
  // Generate comments
  const comment1 = { type: 'question', content: generateComment(topic, 'question') };
  const comment2 = { type: 'call_to_action', content: generateComment(topic, 'cta') };
  
  // Generate virality analysis
  const viralityAnalysis = generateViralityAnalysis(topic, aspectRatio);
  
  return {
    marketingCopy: {
      title,
      description,
      tags,
      comment1,
      comment2
    },
    viralityAnalysis
  };
};

const generateViralTitle = (topic: string): string => {
  const templates = [
    `你不知道的${topic}秘密！`,
    `${topic}居然这么简单？看完秒懂！`,
    `${topic}新手必看：从0到1全攻略`,
    `${topic}技巧大揭秘：高手都在用的方法`,
    `别再踩坑了！${topic}正确做法是这样的`,
    `${topic}干货：5分钟掌握核心技巧`,
    `震惊！${topic}原来可以这样用`,
    `${topic}实战教程：一步步教你操作`,
    `${topic}进阶：如何从入门到精通`,
    `最新${topic}趋势：2025年必知要点`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
};

const generateViralDescription = (topic: string): string => {
  return `大家好！今天我要分享关于${topic}的实用技巧和最新趋势。\n\n在这个视频中，你将学到：\n• ${topic}的核心概念\n• 实用的${topic}技巧\n• 常见${topic}误区\n• 如何快速提升${topic}能力\n\n如果你觉得这个视频有帮助，请点赞、评论并订阅我的频道，获取更多${topic}相关内容！\n\n#${topic} #教程 #技巧 #干货 #2025趋势`;
};

const generateViralTags = (topic: string): string[] => {
  const baseTags = [topic, '教程', '技巧', '干货', '学习', '入门', '进阶'];
  const randomTags = [
    '2025', '最新', '实用', '指南', '全攻略', '零基础', '高手', '秘诀', '高效', '速成'
  ];
  
  // 随机选择3个标签添加到基础标签中
  const selectedRandomTags = randomTags
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);
  
  return [...baseTags, ...selectedRandomTags];
};

const generateComment = (topic: string, type: 'question' | 'cta'): string => {
  if (type === 'question') {
    const questions = [
      `你对${topic}有什么疑问吗？欢迎在评论区留言！`,
      `关于${topic}，你最想了解什么内容？`,
      `你觉得${topic}最难的部分是什么？`,
      `你用过哪些${topic}工具？效果如何？`,
      `你学习${topic}多长时间了？有什么心得？`
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  } else {
    const ctas = [
      `喜欢这个${topic}视频的话，别忘了点赞收藏哦！`,
      `想学习更多${topic}技巧，记得订阅我的频道！`,
      `转发给需要${topic}教程的朋友吧！`,
      `点击头像进入主页，查看更多${topic}相关内容！`,
      `每周更新${topic}干货，记得准时来看！`
    ];
    return ctas[Math.floor(Math.random() * ctas.length)];
  }
};

const generateViralityAnalysis = (topic: string, aspectRatio: string): ViralityAnalysis => {
  // 模拟分析结果
  const score = Math.floor(Math.random() * 50) + 50; // 50-100分
  let status: ViralityAnalysis['status'] = 'Low';
  
  if (score >= 90) status = 'Viral';
  else if (score >= 75) status = 'High';
  else if (score >= 60) status = 'Medium';
  
  const insights = [
    `${topic}属于热门话题，有良好的传播潜力`,
    `${aspectRatio}比例适合短视频平台，建议保持内容紧凑`,
    `视频开头3秒至关重要，建议添加吸引人的钩子`,
    `结尾添加明确的号召性用语可以提高互动率`,
    `发布时间建议选择用户活跃高峰期`
  ];
  
  // 推荐发布时间
  const recommendedTimes = ['12:00', '18:00', '20:00'];
  
  return {
    score,
    status,
    insights,
    recommendedTimes,
    publishingSchedule: '建议每周发布2-3个视频，保持稳定更新'
  };
};
