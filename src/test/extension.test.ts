import * as vscode from 'vscode';

// You can import your extension's modules to test them.
// import * as myExtension from '../../extension';

describe('Point Blank Extension Test Suite', () => {
	beforeAll(() => {
		vscode.window.showInformationMessage('Starting all Point Blank tests...');
	});

	test('Sample Test - Should be replaced with actual tests', () => {
		// This is a sample test.
		expect([1, 2, 3].indexOf(5)).toBe(-1);
		expect([1, 2, 3].indexOf(0)).toBe(-1);
	});

	afterAll(() => {
		vscode.window.showInformationMessage('All Point Blank tests finished.');
	});
});
