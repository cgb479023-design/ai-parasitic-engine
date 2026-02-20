#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成符合Google NotebookLM格式的知识库文件
"""

import argparse
import datetime
import os

def generate_knowledge_base(content, title, output_path, date=None):
    """
    生成符合NotebookLM格式的知识库文件
    
    Args:
        content (str): 知识库内容
        title (str): 知识库标题
        output_path (str): 输出文件路径
        date (str, optional): 生成日期，默认为当前日期
    """
    if not date:
        date = datetime.datetime.now().strftime('%Y-%m-%d')
    
    # 创建知识库文件内容
    knowledge_base_content = f"""# 📚 知识库 - {title}

**生成时间**: {date}
**包含文档**: 1 个

---

## 📋 目录

1. [{title.replace(' ', '-').lower()}](#{title.replace(' ', '-').lower()})

---

## 📄 {title}.md

{content}
"""
    
    # 确保输出目录存在
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(knowledge_base_content)
    
    print(f"✅ 知识库文件生成成功: {output_path}")
    print(f"📋 生成的文件包含以下内容:")
    print(f"   - 标题: {title}")
    print(f"   - 生成时间: {date}")
    print(f"   - 内容长度: {len(content)} 字符")
    print("\n💡 上传到NotebookLM的步骤:")
    print("1. 打开 Google NotebookLM: https://notebooklm.google.com")
    print("2. 点击 '+ Add sources'")
    print("3. 选择 'Upload files'")
    print(f"4. 选择生成的文件: {output_path}")
    print("5. 等待NotebookLM处理完成")

def main():
    """
    主函数，处理命令行参数
    """
    parser = argparse.ArgumentParser(description='生成符合Google NotebookLM格式的知识库文件')
    parser.add_argument('--content', type=str, help='知识库内容')
    parser.add_argument('--content-file', type=str, help='从文件读取知识库内容')
    parser.add_argument('--title', type=str, required=True, help='知识库标题')
    parser.add_argument('--output', type=str, required=True, help='输出文件路径')
    parser.add_argument('--date', type=str, help='生成日期 (格式: YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    # 读取内容
    if args.content_file:
        with open(args.content_file, 'r', encoding='utf-8') as f:
            content = f.read()
    elif args.content:
        content = args.content
    else:
        parser.error('Either --content or --content-file must be specified')
    
    generate_knowledge_base(content, args.title, args.output, args.date)

if __name__ == '__main__':
    main()
