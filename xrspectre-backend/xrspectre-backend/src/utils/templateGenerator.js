const TYPE_MAP = {
  python: {
    int: 'int', 'int[]': 'List[int]', long: 'int', 'long[]': 'List[int]',
    double: 'float', 'double[]': 'List[float]',
    String: 'str', 'String[]': 'List[str]',
    boolean: 'bool', 'boolean[]': 'List[bool]',
    char: 'str', 'char[]': 'List[str]',
    void: 'None',
  },
  javascript: {
    int: 'number', 'int[]': 'number[]', long: 'number', 'long[]': 'number[]',
    double: 'number', 'double[]': 'number[]',
    String: 'string', 'String[]': 'string[]',
    boolean: 'boolean', 'boolean[]': 'boolean[]',
    char: 'string', 'char[]': 'string[]',
    void: 'void',
  },
  java: {
    int: 'int', 'int[]': 'int[]', long: 'long', 'long[]': 'long[]',
    double: 'double', 'double[]': 'double[]',
    String: 'String', 'String[]': 'String[]',
    boolean: 'boolean', 'boolean[]': 'boolean[]',
    char: 'char', 'char[]': 'char[]',
    void: 'void',
  },
  cpp: {
    int: 'int', 'int[]': 'vector<int>', long: 'long long', 'long[]': 'vector<long long>',
    double: 'double', 'double[]': 'vector<double>',
    String: 'string', 'String[]': 'vector<string>',
    boolean: 'bool', 'boolean[]': 'vector<bool>',
    char: 'char', 'char[]': 'vector<char>',
    void: 'void',
  },
  c: {
    int: 'int', 'int[]': 'int*', long: 'long', 'long[]': 'long*',
    double: 'double', 'double[]': 'double*',
    String: 'char*', 'String[]': 'char**',
    boolean: 'int', 'boolean[]': 'int*',
    char: 'char', 'char[]': 'char*',
    void: 'void',
  },
};

function mapType(type, lang) {
  return TYPE_MAP[lang]?.[type] || type;
}

function paramsStr(params, lang) {
  if (lang === 'python') {
    const mapped = params.map((p) => `${p.name}: ${mapType(p.type, 'python')}`);
    return mapped.join(', ');
  }
  if (lang === 'c') {
    const mapped = params.map((p) => {
      const type = mapType(p.type, 'c');
      if (type.endsWith('*')) {
        return `${type} ${p.name}, int ${p.name}_len`;
      }
      return `${type} ${p.name}`;
    });
    return mapped.join(', ');
  }
  const mapped = params.map((p) => `${mapType(p.type, lang)} ${p.name}`);
  return mapped.join(', ');
}

function returnStr(type, lang) {
  if (lang === 'python') {
    const r = mapType(type, 'python');
    return r === 'None' ? '' : ` -> ${r}`;
  }
  return '';
}

function javaReturnPrefix(type) {
  const t = mapType(type, 'java');
  return t === 'void' ? '' : 'return ';
}

export function generateTemplates(signature) {
  if (!signature || !signature.name) return {};

  const { returnType = 'void', name, params = [] } = signature;
  const p = paramsStr.bind(null, params);
  const r = returnStr.bind(null, returnType);

  const templates = {};

  templates.python = `def ${name}(${p('python')})${r('python')}:
    # write your code below`;

  templates.javascript = `function ${name}(${p('javascript')}) {
    // write your code below
}`;

  templates.java = `class Solution {
    public ${mapType(returnType, 'java')} ${name}(${p('java')}) {
        // write your code below
    }
}`;

  templates.cpp = `#include <bits/stdc++.h>
using namespace std;

${mapType(returnType, 'cpp')} ${name}(${p('cpp')}) {
    // write your code below
}`;

  templates.c = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${mapType(returnType, 'c')} ${name}(${p('c')}) {
    // write your code below
}`;

  return templates;
}

export function generateTemplateForLang(signature, lang) {
  const all = generateTemplates(signature);
  return all[lang] || '';
}
