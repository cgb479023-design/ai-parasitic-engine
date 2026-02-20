import { SecurityScanner, ScanResult } from '../services/securityScanService';
import path from 'path';
import { vi } from 'vitest'; // Import vi from vitest

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  // Mock implementation for getSourceFiles and readFile for isolated testing
  const mockSourceFiles: { [key: string]: string } = {};
  const mockGetSourceFiles = async () => Object.keys(mockSourceFiles);
  const mockReadFile = async (filePath: string) => {
    if (mockSourceFiles[filePath]) {
      return mockSourceFiles[filePath];
    }
    throw new Error(`File not found: ${filePath}`);
  };

  beforeAll(() => {
    scanner = new SecurityScanner(); // Initialize scanner here
    // Override the actual implementations with mocks
    vi.spyOn(scanner, 'getSourceFiles' as any).mockImplementation(mockGetSourceFiles);
    vi.spyOn(scanner, 'readFile' as any).mockImplementation(mockReadFile);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  const expectNoIssues = (results: any[], filePath: string) => {
    const fileResults = results.filter(r => path.normalize(r.file) === path.normalize(filePath));
    expect(fileResults).toEqual([]);
  };

  const expectIssue = (results: any[], filePath: string, expectedRule: string, expectedLine?: number) => {
    console.log(`\n--- Debugging expectIssue for ${expectedRule} at line ${expectedLine} in ${filePath} ---`);
    console.log('Raw results array passed to expectIssue:', JSON.stringify(results, null, 2));
    const normalizedExpectedFilePath = path.normalize(filePath);
    console.log('Normalized filePath expected in test:', normalizedExpectedFilePath);

    const fileResults = results.filter(r => {
      const normalizedResultFile = path.normalize(r.file);
      console.log(`  Comparing Result File: ${normalizedResultFile} with Expected File: ${normalizedExpectedFilePath}`);
      return normalizedResultFile === normalizedExpectedFilePath; // Corrected comparison here
    });
    console.log('Filtered fileResults:', JSON.stringify(fileResults, null, 2));
    expect(fileResults.length).toBeGreaterThan(0);
    const foundIssue = fileResults.find(r => {
      // Extract rule name from the ID which is in the format 'filePath_ruleName_lineCount'
      const ruleFromId = r.id.split('_')[1];
      const isRuleMatch = ruleFromId === expectedRule;
      const isLineMatch = expectedLine ? r.line === expectedLine : true;
      console.log(`  Issue ID: ${r.id}, Rule from ID: ${ruleFromId}, Is Rule Match: ${isRuleMatch}`);
      console.log(`  Issue Line: ${r.line}, Expected Line: ${expectedLine}, Is Line Match: ${isLineMatch}`);
      return isRuleMatch && isLineMatch;
    });
    console.log('Found issue:', JSON.stringify(foundIssue, null, 2));
    expect(foundIssue).toBeDefined();
    return foundIssue;
  };

  // --- Test Cases for Insecure React Lifecycle Methods (codeQuality.insecureReactLifecycle) ---
  test('should detect insecure React componentWillMount lifecycle method', async () => {
    const filePath = 'src/components/VulnerableComponent.tsx';
    mockSourceFiles[filePath] = `
import React from 'react';
class VulnerableComponent extends React.Component {
  componentWillMount() {
    console.log('Mounting...');
  }
  render() {
    return <div>Hello</div>;
  }
}
export default VulnerableComponent;
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectIssue(results, filePath, 'insecureReactLifecycle', 3);
  });

  test('should detect insecure React componentWillReceiveProps lifecycle method', async () => {
    const filePath = 'src/components/VulnerableComponent.tsx';
    mockSourceFiles[filePath] = `
import React from 'react';
class VulnerableComponent extends React.Component {
  componentWillReceiveProps(nextProps: any) {
    console.log('Receiving props', nextProps);
  }
  render() {
    return <div>Hello</div>;
  }
}
export default VulnerableComponent;
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectIssue(results, filePath, 'insecureReactLifecycle', 3);
  });

  test('should detect insecure React componentWillUpdate lifecycle method', async () => {
    const filePath = 'src/components/VulnerableComponent.tsx';
    mockSourceFiles[filePath] = `
import React from 'react';
class VulnerableComponent extends React.Component {
  componentWillUpdate(nextProps: any, nextState: any) {
    console.log('Updating...');
  }
  render() {
    return <div>Hello</div>;
  }
}
export default VulnerableComponent;
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectIssue(results, filePath, 'insecureReactLifecycle', 3);
  });

  test('should not detect insecure React lifecycle methods in functional components', async () => {
    const filePath = 'src/components/SafeComponent.tsx';
    mockSourceFiles[filePath] = `
import React from 'react';
import { useEffect } from 'react';
const SafeComponent = () => {
  useEffect(() => {
    console.log('Mounted');
  }, []);
  return <div>Safe</div>;
};
export default SafeComponent;
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectNoIssues(results, filePath);
  });

  // --- Test Cases for Missing rel="noopener noreferrer" (xss.missingRelNoopener) ---
  test('should detect missing rel="noopener noreferrer" on target="_blank" links', async () => {
    const filePath = 'src/templates/VulnerablePage.tsx';
    mockSourceFiles[filePath] = `
<a href="https://external.com" target="_blank">External Link</a>
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectIssue(results, filePath, 'missingRelNoopener', 1);
  });

  test('should detect missing rel="noopener" even if noreferrer is present', async () => {
    const filePath = 'src/templates/VulnerablePage.tsx';
    mockSourceFiles[filePath] = `
<a href="https://external.com" target="_blank" rel="noreferrer">External Link</a>
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectIssue(results, filePath, 'missingRelNoopener', 1);
  });

  test('should not detect missing rel="noopener noreferrer" if both are present', async () => {
    const filePath = 'src/templates/SafePage.tsx';
    mockSourceFiles[filePath] = `
<a href="https://external.com" target="_blank" rel="noopener noreferrer">External Link</a>
<a href="https://another.com" target="_blank" rel="noreferrer noopener">Another Link</a>
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectNoIssues(results, filePath);
  });

  test('should not detect missing rel="noopener noreferrer" on internal links or without target="_blank"', async () => {
    const filePath = 'src/templates/SafePage.tsx';
    mockSourceFiles[filePath] = `
<a href="/internal-page">Internal Link</a>
<a href="https://external.com">External Link without blank target</a>
<a href="https://external.com" target="_self">Self Target</a>
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectNoIssues(results, filePath);
  });

  // --- Test Cases for Broad postMessage Target (network.broadPostMessageTarget) ---
  test('should detect broad postMessage target using "*"', async () => {
    const filePath = 'src/utils/VulnerableMessenger.ts';
    mockSourceFiles[filePath] = `
window.parent.postMessage({ type: 'DATA', payload: 'secret' }, '*');
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectIssue(results, filePath, 'broadPostMessageTarget', 1);
  });

  test('should not detect broad postMessage target when a specific origin is used', async () => {
    const filePath = 'src/utils/SafeMessenger.ts';
    mockSourceFiles[filePath] = `
window.parent.postMessage({ type: 'DATA', payload: 'safe' }, 'https://safeorigin.com');
window.parent.postMessage({ type: 'DATA', payload: 'safe' }, window.location.origin);
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectNoIssues(results, filePath);
  });

  // --- Combined Test Case (demonstrates multiple rules) ---
  test('should detect multiple issues in a single file', async () => {
    const filePath = 'src/components/MixedVulnerabilities.tsx';
    mockSourceFiles[filePath] = `
import React from 'react';
class MixedVulnerabilities extends React.Component {
  componentWillMount() {
    console.log('Legacy mount');
  }
  render() {
    return (
      <div>
        <a href="https://badlink.com" target="_blank">Bad Link 1</a>
        <a href="https://anotherbad.com" target="_blank" rel="noreferrer">Bad Link 2</a>
        <button onClick={() => window.parent.postMessage('sensitive', '*')}>Send Data</button>
      </div>
    );
  }
}
export default MixedVulnerabilities;
    `;
    const results = await scanner.scanFile(filePath, mockSourceFiles[filePath]); // Call scanFile with content
    expectIssue(results, filePath, 'insecureReactLifecycle', 3);
    expectIssue(results, filePath, 'missingRelNoopener', 9);
    expectIssue(results, filePath, 'missingRelNoopener', 10);
    expectIssue(results, filePath, 'broadPostMessageTarget', 11);
  });

});
