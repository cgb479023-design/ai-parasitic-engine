#!/usr/bin/env node

/**
 * Dependency Management Service
 * 自动检测和管理依赖更新和安全漏洞
 */

interface DependencyInfo {
  name: string;
  version: string;
  installedVersion?: string;
  latestVersion?: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  outdated: boolean;
  vulnerability: {
    hasKnown: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
    description?: string;
  };
}

interface SecurityReport {
  package: string;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface DependencyReport {
  dependencies: DependencyInfo[];
  summary: {
    total: number;
    outdated: number;
    withVulnerabilities: number;
    securityScore: number; // 0-100
  };
  recommendations: string[];
}

const DEPENDENCY_CHECK_INTERVALS = 24 * 60 * 60 * 1000; // Check daily
const VULNERABILITY_API = 'https://api.npmjs.org/vulnerabilities';

export class DependencyManager {
  private dependencyCache: Map<string, DependencyInfo> = new Map();
  private securityCache: Map<string, SecurityReport> = new Map();

  /**
   * 检查过时依赖
   */
  async checkOutdated(): Promise<DependencyInfo[]> {
    console.log('\n🔍 Checking for outdated dependencies...');

    try {
      const execSync = require('child_process').execSync;
      const stdout = execSync('npm outdated --json', {
        cwd: process.cwd(),
        encoding: 'utf8'
      });

      const outdated: any = JSON.parse(stdout);
      
      if (!outdated || outdated.length === 0) {
        console.log('✅ All dependencies are up to date');
        return [];
      }

      const dependencies = Object.entries(outdated).map(([name, info]) => ({
        name,
        version: info.current,
        latestVersion: info.latest,
        outdated: true,
        type: 'dependency' as const,
        vulnerability: { hasKnown: false, severity: 'none' as const }
      }));

      console.log(`📦 Found ${dependencies.length} outdated dependencies`);

      // 缓存结果
      dependencies.forEach(dep => {
        this.dependencyCache.set(dep.name, dep);
      });

      return dependencies;
    } catch (error) {
      console.error('❌ Failed to check for outdated dependencies:', error);
      return [];
    }
  }

  /**
   * 检查安全漏洞
   */
  async checkVulnerabilities(): Promise<Map<string, SecurityReport>> {
    console.log('\n🔒 Checking for security vulnerabilities...');

    try {
      const execSync = require('child_process').execSync;
      const stdout = execSync('npm audit --json', {
        cwd: process.cwd(),
        encoding: 'utf8'
      });

      const audit: any = JSON.parse(stdout);
      
      if (!audit || audit.metadata?.vulnerabilities?.length === 0) {
        console.log('✅ No vulnerabilities found');
        return new Map();
      }

      const vulnerabilities = audit.metadata?.vulnerabilities || {};
      const report = new Map();

      Object.entries(vulnerabilities).forEach(([pkgName, vulns]) => {
        const critical = vulns.filter(v => v.severity === 'critical').length;
        const high = vulns.filter(v => v.severity === 'high').length;
        const medium = vulns.filter(v => v.severity === 'medium').length;
        const low = vulns.filter(v => v.severity === 'low').length;
        
        const totalVulns = critical + high + medium + low;
        const severity = totalVulns > 0 
          ? critical > 0 ? 'critical' : high > 0 ? 'high' : medium > 0 ? 'medium' : 'low'
          : 'none' as const;

        const securityReport: SecurityReport = {
          package: pkgName,
          vulnerabilities: { critical, high, medium, low }
        };

        // 计算安全分数
        const securityScore = this.calculateSecurityScore(securityReport);

        report.set(pkgName, securityReport);
      });

      console.log(`📊 Found vulnerabilities in ${report.size} packages`);
      console.log(`   Total vulnerabilities: ${Object.values(report).reduce((sum, r) => sum + r.vulnerabilities.critical + r.vulnerabilities.high + r.vulnerabilities.medium + r.vulnerabilities.low, 0)}`);

      return report;
    } catch (error) {
      console.error('❌ Failed to check for security vulnerabilities:', error);
      return new Map();
    }
  }

  /**
   * 计算安全分数
   */
  private calculateSecurityScore(report: SecurityReport): number {
    const { vulnerabilities } = report;
    
    // 权重计算
    const score = 100 
      - (vulnerabilities.critical * 50)
      - (vulnerabilities.high * 20)
      - (vulnerabilities.medium * 10)
      - (vulnerabilities.low * 5);

    return Math.max(0, score);
  }

  /**
   * 生成依赖报告
   */
  async generateReport(): Promise<DependencyReport> {
    console.log('\n📋 Generating dependency report...');

    const [outdated, vulnerabilities] = await Promise.all([
      this.checkOutdated(),
      this.checkVulnerabilities()
    ]);

    // 合并结果
    const allDependencies = new Map<string, DependencyInfo>();
    
    // 添加所有过时依赖
    outdated.forEach(dep => {
      allDependencies.set(dep.name, dep);
    });

    // 添加未过时的依赖
    const packageJson = JSON.parse(require('fs').readFileSync('package.json', 'utf8'));
    Object.entries(packageJson.dependencies || {}).forEach(([name, version]) => {
      if (!allDependencies.has(name)) {
        allDependencies.set(name, {
          name,
          version,
          outdated: false,
          type: 'dependency' as const,
          vulnerability: { hasKnown: false, severity: 'none' as const }
        });
      }
    });

    // 更新漏洞信息
    vulnerabilities.forEach((report, pkgName) => {
      const dep = allDependencies.get(pkgName);
      if (dep) {
        dep.vulnerability = {
          hasKnown: true,
          severity: report.vulnerabilities.critical > 0 ? 'critical' : report.vulnerabilities.high > 0 ? 'high' : report.vulnerabilities.medium > 0 ? 'medium' : 'low' as const
        };
      }
    });

    const total = allDependencies.size;
    const outdatedCount = outdated.length;
    const withVulnsCount = Array.from(vulnerabilities.values())
      .filter(report => report.vulnerabilities.critical > 0 || report.vulnerabilities.high > 0).length;

    const summary = {
      total,
      outdated: outdatedCount,
      withVulnerabilities: withVulnsCount
    };

    // 计算项目安全分数
    const securityScores = Array.from(vulnerabilities.values())
      .map(report => this.calculateSecurityScore(report));
    const avgSecurityScore = securityScores.length > 0
      ? securityScores.reduce((sum, score) => sum + score, 0) / securityScores.length
      : 100;

    // 生成建议
    const recommendations: string[] = [];
    if (outdatedCount > 0) {
      recommendations.push(`📦 Update ${outdatedCount} outdated dependencies`);
    }
    if (withVulnsCount > 0) {
      recommendations.push(`🔒 Fix security vulnerabilities in ${withVulnsCount} packages`);
    }
    if (avgSecurityScore < 70) {
      recommendations.push('⚠️  Overall security score is below 70%, review dependencies carefully');
    }

    const reportData: DependencyReport = {
      dependencies: Array.from(allDependencies.values()),
      summary,
      recommendations
    };

    console.log('✅ Dependency report generated');
    return reportData;
  }

  /**
   * 安装依赖
   */
  async updateDependencies(): Promise<boolean> {
    console.log('\n📦 Updating dependencies...');

    try {
      const execSync = require('child_process').execSync;
      execSync('npm update', { cwd: process.cwd() });
      console.log('✅ Dependencies updated');
      return true;
    } catch (error) {
      console.error('❌ Failed to update dependencies:', error);
      return false;
    }
  }

  /**
   * 清理未使用的依赖
   */
  async cleanDependencies(): Promise<boolean> {
    console.log('\n🧹 Cleaning unused dependencies...');

    try {
      const execSync = require('child_process').execSync;
      execSync('npm prune', { cwd: process.cwd() });
      console.log('✅ Unused dependencies cleaned');
      return true;
    } catch (error) {
      console.error('❌ Failed to clean dependencies:', error);
      return false;
    }
  }

  /**
   * 安装缺失依赖
   */
  async installMissingDependencies(): Promise<boolean> {
    console.log('\n📥 Installing missing dependencies...');

    try {
      const execSync = require('child_process').execSync;
      execSync('npm install', { cwd: process.cwd() });
      console.log('✅ Dependencies installed');
      return true;
    } catch (error) {
      console.error('❌ Failed to install dependencies:', error);
      return false;
    }
  }

  /**
   * 获取依赖列表
   */
  getDependencyList(): DependencyInfo[] {
    return Array.from(this.dependencyCache.values());
  }

  /**
   * 导出报告
   */
  exportReport(report: DependencyReport): string {
    let output = '\n' + '='.repeat(70);
    output += '\n📦 DEPENDENCY MANAGEMENT REPORT';
    output += '\n' + '='.repeat(70) + '\n';

    output += '\n📊 Summary:\n';
    output += `   Total Dependencies: ${report.summary.total}\n`;
    output += `   Outdated: ${report.summary.outdated}\n`;
    output += `   With Vulnerabilities: ${report.summary.withVulnerabilities}\n`;
    output += `   Security Score: ${avgSecurityScore.toFixed(1)}%\n`;

    output += '\n📦 Outdated Dependencies:\n';
    report.dependencies
      .filter(dep => dep.outdated)
      .forEach((dep, i) => {
        output += `\n   ${i + 1}. ${dep.name}\n`;
        output += `      Current: ${dep.version}\n`;
        output += `      Latest: ${dep.latestVersion}\n`;
        output += `      Type: ${dep.type}\n`;
      });

    output += '\n🔒 Vulnerabilities:\n';
    Array.from(this.securityCache.entries())
      .forEach(([pkgName, report]) => {
        const vulns = report.vulnerabilities;
        if (vulns.critical > 0) {
          output += `\n   ${pkgName}:\n`;
          output += `      Critical: ${vulns.critical}\n`;
        }
        if (vulns.high > 0) {
          output += `      High: ${vulns.high}\n`;
        }
        if (vulns.medium > 0) {
          output += `      Medium: ${vulns.medium}\n`;
        }
        if (vulns.low > 0) {
          output += `      Low: ${vulns.low}\n`;
        }
      });

    output += '\n💡 Recommendations:\n';
    report.recommendations.forEach((rec, i) => {
      output += `\n   ${i + 1}. ${rec}\n`;
    });

    output += '\n' + '='.repeat(70);

    return output;
  }

  /**
   * 缓存管理
   */
  clearCache(): void {
    this.dependencyCache.clear();
    this.securityCache.clear();
    console.log('🔄 Dependency cache cleared');
  }
}

// 导出单例实例
export const dependencyManager = new DependencyManager();