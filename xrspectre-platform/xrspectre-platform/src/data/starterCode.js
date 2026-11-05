// Starter code for questions without a function signature: the program
// reads the test case from standard input and prints the answer.
// Java must use class Main — every executor compiles Main.java.
export const STARTER_CODE = {
  javascript: `const input = require('fs').readFileSync(0, 'utf8').trim();\n\n// write your solution — print the answer with console.log()\n`,
  python: `import sys\n\ndata = sys.stdin.read().split()\n\n# write your solution — print the answer\n`,
  c: `#include <stdio.h>\n\nint main() {\n    // write your solution\n    return 0;\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution\n    return 0;\n}\n`,
  java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // write your solution\n    }\n}\n`,
};

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
];

export const THEMES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];
