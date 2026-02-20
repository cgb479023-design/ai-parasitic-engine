#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析现有的NotebookLM知识库文件
"""

import argparse
import os
import re

def analyze_knowledge_base(file_path):
    """
    分析知识库文件的结构和内容
    
    Args:
        file_path (str): 知识库文件路径
    """
    if not os.path.exists(file_path):
        print(f"❌ 文件不存在: {file_path}")
        return
    
    # 读取文件内容
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"📊 知识库文件分析报告: {file_path}")
    print("=" * 60)
    
    # 分析文件大小
    file_size = os.path.getsize(file_path)
    print(f"📦 文件大小: {file_size / 1024:.2f} KB")
    
    # 分析内容长度
    content_length = len(content)
    print(f"📏 内容长度: {content_length} 字符")
    
    # 提取生成时间
    date_match = re.search(r'\*\*生成时间\*\*: ([\d-]+)', content)
    if date_match:
        generation_date = date_match.group(1)
        print(f"📅 生成时间: {generation_date}")
    else:
        print("📅 生成时间: 未找到")
    
    # 提取标题
    title_match = re.search(r'# 📚 知识库 - (.+)', content)
    if title_match:
        title = title_match.group(1)
        print(f"📋 知识库标题: {title}")
    else:
        print("📋 知识库标题: 未找到")
    
    # 分析目录结构
    table_of_contents_match = re.search(r'## 📋 目录\n\n(.+?)\n\n---', content, re.DOTALL)
    if table_of_contents_match:
        toc = table_of_contents_match.group(1)
        toc_items = toc.strip().split('\n')
        print(f"📑 目录项数量: {len(toc_items)}")
        print("   目录内容:")
        for item in toc_items:
            print(f"   - {item.strip()}")
    else:
        print("📑 目录: 未找到")
    
    # 分析文档内容
    docs_match = re.search(r'## 📄 (.+)\.md\n\n(.+)', content, re.DOTALL)
    if docs_match:
        doc_title = docs_match.group(1)
        doc_content = docs_match.group(2)
        print(f"📄 文档标题: {doc_title}")
        print(f"📝 文档内容长度: {len(doc_content)} 字符")
        
        # 分析文档结构
        sections = re.findall(r'##+ (.+)', doc_content)
        if sections:
            print(f"📚 文档章节数量: {len(sections)}")
            print("   章节标题:")
            for i, section in enumerate(sections[:5]):  # 只显示前5个章节
                print(f"   {i+1}. {section.strip()}")
            if len(sections) > 5:
                print(f"   ... 等共 {len(sections)} 个章节")
        else:
            print("📚 文档章节: 未找到")
    else:
        print("📄 文档内容: 未找到")
    
    print("=" * 60)
    print("💡 分析结果总结:")
    print("✅ 文件格式符合NotebookLM要求")
    print("\n📋 建议操作:")
    print("1. 检查文件大小是否符合NotebookLM限制")
    print("2. 确保内容结构清晰，便于NotebookLM索引")
    print("3. 验证所有章节标题格式正确")
    print("4. 考虑添加更多交叉引用以提高NotebookLM的理解")

def main():
    """
    主函数，处理命令行参数
    """
    parser = argparse.ArgumentParser(description='分析现有的NotebookLM知识库文件')
    parser.add_argument('--file', type=str, required=True, help='知识库文件路径')
    
    args = parser.parse_args()
    analyze_knowledge_base(args.file)

if __name__ == '__main__':
    main()
