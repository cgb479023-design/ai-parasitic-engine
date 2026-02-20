# Fast Collect 功能编码规范

## 1. JSON 处理规范

### 1.1 必须使用 safeJsonParse 函数
**规则**：所有 JSON 解析必须使用 `safeJsonParse` 函数，禁止直接使用 `JSON.parse`

**理由**：`safeJsonParse` 函数包含了对各种非标准 JSON 格式的处理，如反引号、尾随逗号等

**示例**：
```javascript
// ✅ 正确用法
const data = safeJsonParse(rawData, { context: 'Fast Collect' });

// ❌ 错误用法
const data = JSON.parse(rawData);
```

### 1.2 增强数据清理
**规则**：在 `safeJsonParse` 函数中持续增强数据清理规则，处理各种非标准格式

**理由**：外部数据源提供的数据格式可能不符合标准规范，需要进行充分的清理

**清理规则**：
1. 替换反引号为引号：`cleanedJson = cleanedJson.replace(/`/g, '"');`
2. 移除尾随逗号：`cleanedJson = cleanedJson.replace(/,\s*([}\]])/g, '$1');`
3. 移除控制字符：`cleanedJson = cleanedJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');`
4. 修复单引号：`cleanedJson = cleanedJson.replace(/'([\w]+)'/g, '"$1"');`

### 1.3 严格类型检查
**规则**：实施更严格的类型检查，确保数据类型的一致性

**理由**：外部数据的类型可能不符合预期，需要进行严格的类型检查

**示例**：
```javascript
// 确保返回的是数组
if (!Array.isArray(result.videoPerformance.top_5_videos)) {
  result.videoPerformance.top_5_videos = [];
}

// 确保返回的是数字
if (typeof result.channelOverview.total_subscribers !== 'number') {
  result.channelOverview.total_subscribers = parseInt(result.channelOverview.total_subscribers) || 0;
}
```

## 2. 错误处理规范

### 2.1 统一错误格式
**规则**：所有错误必须包含上下文信息，便于调试和监控

**理由**：详细的错误信息有助于快速定位和解决问题

**错误格式**：
```javascript
console.error(`❌ [Fast Collect] ${context} 失败:`, error, { 
  category, 
  retries: retryCount, 
  maxRetries: MAX_RETRIES 
});
```

### 2.2 增强容错能力
**规则**：确保在数据格式异常时仍能返回有意义的默认值

**理由**：外部数据可能随时变化，需要确保系统的稳定性

**示例**：
```javascript
// 提供默认值，确保返回的数据结构完整
return {
  yppSprint: result.yppSprint || { progress: 50 },
  channelOverview: result.channelOverview || { views: 0 },
  videoPerformance: result.videoPerformance || { top_5_videos: [] },
  // ... 其他默认值
};
```

### 2.3 详细日志记录
**规则**：增加日志记录，包括数据清理前后的对比，便于调试

**理由**：详细的日志记录有助于追踪数据处理流程，快速定位问题

**日志级别**：
- `debug`: 详细的调试信息，包括数据清理前后的对比
- `info`: 正常的运行信息
- `warn`: 警告信息，如数据格式异常但不影响系统运行
- `error`: 错误信息，如数据处理失败

**示例**：
```javascript
debug(`📊 [${category}] 原始数据:`, rawData.substring(0, 200));
debug(`📊 [${category}] 清理后数据:`, cleanedData.substring(0, 200));
```

## 3. 测试规范

### 3.1 覆盖边界情况
**规则**：增加对各种边界情况的测试，包括非标准 JSON 格式

**理由**：外部数据可能包含各种边界情况，需要确保系统能够处理

**边界情况**：
1. 包含反引号的 JSON 格式
2. 包含尾随逗号的 JSON 格式
3. 包含控制字符的 JSON 格式
4. 包含单引号的 JSON 格式
5. 空 JSON 对象
6. 缺少必要字段的 JSON 对象

**示例**：
```javascript
// 测试包含反引号的 JSON 格式
const testJsonWithBackticks = '{"title": `https://example.com/video/123`}';
const result = safeJsonParse(testJsonWithBackticks);
assert.equal(result.title, 'https://example.com/video/123');
```

### 3.2 自动化测试
**规则**：建立自动化测试框架，定期测试 Fast Collect 功能

**理由**：自动化测试可以确保功能的稳定性，及时发现问题

**测试内容**：
1. JSON 解析功能
2. 数据收集流程
3. 错误处理机制
4. 性能测试

**测试频率**：
- 每次代码修改后运行单元测试
- 每日运行完整测试套件
- 每周运行性能测试

### 3.3 集成测试
**规则**：确保整个数据收集流程的完整性测试

**理由**：集成测试可以确保各个组件之间的协作正常

**集成测试内容**：
1. 从数据收集到数据展示的完整流程
2. 各种异常情况的处理
3. 性能和稳定性测试

## 4. 外部数据处理规范

### 4.1 数据验证
**规则**：在数据收集阶段就进行格式检查，确保数据格式符合预期

**理由**：提前进行数据验证，可以避免后续处理中的问题

**验证内容**：
1. 检查数据是否为 JSON 格式
2. 检查数据是否包含必要字段
3. 检查数据类型是否符合预期
4. 检查数据范围是否合理

**示例**：
```javascript
// 验证数据格式
if (!isValidJson(rawData)) {
  warn(`⚠️ [${category}] 数据格式无效，尝试清理...`);
  rawData = cleanJsonData(rawData);
}

// 验证必要字段
if (!result.videoPerformance) {
  error(`❌ [${category}] 缺少必要字段: videoPerformance`);
  result.videoPerformance = { top_5_videos: [] };
}
```

### 4.2 数据监控
**规则**：实现数据格式监控，实时监控数据格式的变化，及时发现问题

**理由**：外部数据的格式可能随时变化，需要及时发现和处理

**监控内容**：
1. JSON 解析成功率
2. 数据字段的完整性
3. 数据类型的一致性
4. 数据范围的合理性

**监控方式**：
- 日志记录
- 指标收集
- 告警机制

### 4.3 数据质量报告
**规则**：定期生成数据质量报告，分析数据格式的稳定性

**理由**：数据质量报告有助于了解外部数据源的可靠性，及时调整处理策略

**报告内容**：
1. JSON 解析成功率
2. 各种非标准格式的出现频率
3. 数据字段的完整性统计
4. 数据类型的一致性统计

**报告频率**：
- 每日生成基本报告
- 每周生成详细报告
- 每月生成趋势报告

## 5. 性能优化规范

### 5.1 优化 safeJsonParse 函数
**规则**：持续优化 `safeJsonParse` 函数的性能，确保在处理大量数据时的效率

**理由**：Fast Collect 功能可能需要处理大量数据，性能优化非常重要

**优化方向**：
1. 减少不必要的正则表达式替换
2. 优化正则表达式的执行效率
3. 增加缓存机制，避免重复处理相同的数据
4. 优化错误处理逻辑，减少异常抛出的次数

### 5.2 批量处理数据
**规则**：对大量数据进行批量处理，减少内存占用和处理时间

**理由**：批量处理可以提高处理效率，减少系统资源占用

**批量处理策略**：
1. 按类别分批处理数据
2. 每批次处理的数据量不超过系统资源限制
3. 合理设置批次大小，平衡处理效率和系统资源占用

**示例**：
```javascript
// 按类别分批处理数据
const BATCH_SIZE = 3;
for (let i = 0; i < categories.length; i += BATCH_SIZE) {
  const batch = categories.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(category => collectCategory(category)));
}
```

## 6. 审核流程规范

### 6.1 代码评审要点
**规则**：在代码评审中重点检查以下内容

**评审要点**：
1. 是否使用了 `safeJsonParse` 函数
2. 错误处理机制是否完善
3. 日志记录是否充分
4. 类型检查是否严格
5. 性能优化是否合理
6. 测试覆盖是否完整

### 6.2 自动化审核工具
**规则**：使用自动化审核工具，提高审核效率和准确性

**自动化审核工具**：
1. ESLint：检查代码风格和潜在问题
2. Prettier：格式化代码
3. TypeScript：类型检查
4. 自定义审核脚本：检查特定的编码规范

### 6.3 定期审核
**规则**：定期对 Fast Collect 功能进行全面审核

**审核频率**：
- 每次代码修改后进行代码评审
- 每月进行全面的功能审核
- 每季度进行全面的性能审核

## 7. 监控和告警规范

### 7.1 监控点设置
**规则**：在关键流程设置监控点，监控系统的运行状态

**监控点**：
1. JSON 解析成功率
2. 数据收集成功率
3. 数据处理时间
4. 系统资源占用
5. 错误出现频率

### 7.2 告警规则
**规则**：建立适当的告警规则，及时发现问题

**告警级别**：
1. **严重**：系统无法运行，如数据收集完全失败
2. **高**：重要功能受影响，如部分数据收集失败
3. **中**：性能下降，如处理时间明显增加
4. **低**：轻微问题，如少量数据格式异常

**告警方式**：
1. 日志记录
2. 邮件告警
3. 实时监控仪表板
4. 短信告警（仅严重级别）

### 7.3 故障处理流程
**规则**：建立完善的故障处理流程，确保及时处理问题

**故障处理流程**：
1. **发现问题**：通过监控系统或用户反馈发现问题
2. **定位问题**：通过日志和调试工具定位问题
3. **修复问题**：根据问题定位结果修复代码
4. **验证修复**：运行测试套件验证修复效果
5. **部署修复**：将修复后的代码部署到生产环境
6. **总结分析**：分析问题原因，提出改进措施

## 8. 结论

Fast Collect 功能的编码规范旨在确保系统的稳定性、可靠性和性能。通过实施上述规范，可以提高系统的鲁棒性和容错能力，确保 Fast Collect 功能的稳定运行。

同时，这些规范也有助于提高代码质量，便于维护和扩展，减少后续的开发和维护成本。

所有开发人员必须严格遵守这些规范，确保 Fast Collect 功能的高质量和稳定性。
