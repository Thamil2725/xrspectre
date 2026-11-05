const TYPE_INFO = {
  int:     { cpp: 'int',            java: 'int'     },
  'int[]': { cpp: 'vector<int>',    java: 'int[]'   },
  long:    { cpp: 'long long',      java: 'long'    },
  'long[]':{ cpp: 'vector<long long>', java: 'long[]'},
  double:  { cpp: 'double',         java: 'double'  },
  'double[]':{ cpp: 'vector<double>', java: 'double[]'},
  String:  { cpp: 'string',         java: 'String'  },
  'String[]':{ cpp: 'vector<string>', java: 'String[]'},
  boolean: { cpp: 'bool',           java: 'boolean' },
  'boolean[]':{ cpp: 'vector<bool>', java: 'boolean[]'},
  char:    { cpp: 'char',           java: 'char'    },
  'char[]':{ cpp: 'vector<char>',   java: 'char[]'  },
};

const CONV_FN = {
  int: 'toInt', 'int[]': 'toIntArr',
  long: 'toLong', 'long[]': 'toLongArr',
  double: 'toDouble', 'double[]': 'toDoubleArr',
  String: 'toStr', 'String[]': 'toStrArr',
  boolean: 'toBool', 'boolean[]': 'toBoolArr',
  char: 'toChar', 'char[]': 'toCharArr',
};

const C_TYPE_INFO = {
  int: 'int', 'int[]': 'int*', long: 'long', 'long[]': 'long*',
  double: 'double', 'double[]': 'double*',
  String: 'char*', 'String[]': 'char**',
  boolean: 'int', 'boolean[]': 'int*',
  char: 'char', 'char[]': 'char*',
  void: 'void',
};

const C_CONV_FN = {
  int: 'toInt', 'int[]': 'toIntArr',
  long: 'toLong', 'long[]': 'toLongArr',
  double: 'toDouble', 'double[]': 'toDoubleArr',
  String: 'toStr', 'String[]': 'toStrArr',
  boolean: 'toBool', 'boolean[]': 'toBoolArr',
  char: 'toChar', 'char[]': 'toCharArr',
};

const C_PRINT_FN = {
  int: 'printJsonInt', 'int[]': 'printJsonIntArr',
  long: 'printJsonLong', 'long[]': 'printJsonLongArr',
  double: 'printJsonDouble', 'double[]': 'printJsonDoubleArr',
  String: 'printJsonStr', 'String[]': 'printJsonStrArr',
  boolean: 'printJsonBool', 'boolean[]': 'printJsonBoolArr',
  char: 'printJsonChar', 'char[]': 'printJsonCharArr',
};

const CPP_PREAMBLE = String.raw`
struct J {
  enum T { N, B, NUM, STR, ARR } t;
  bool bv; double nv; string sv; vector<J> av;
  J() : t(N), bv(false), nv(0) {}
};
J parseJ(const string& s, int& i) {
  while (i < (int)s.size() && s[i] <= ' ') i++;
  if (i >= (int)s.size()) return J();
  if (s[i] == '"') { i++; string v; while (i < (int)s.size() && s[i] != '"') { if (s[i] == '\\') { i++; if (i < (int)s.size()) v += s[i]; } else v += s[i]; i++; } i++; J j; j.t = J::STR; j.sv = v; return j; }
  if (s[i] == '[') { i++; vector<J> v; while (i < (int)s.size() && s[i] != ']') { v.push_back(parseJ(s, i)); while (i < (int)s.size() && (s[i] == ',' || s[i] <= ' ')) i++; } i++; J j; j.t = J::ARR; j.av = v; return j; }
  if (s[i] == 't') { i += 4; J j; j.t = J::B; j.bv = true; return j; }
  if (s[i] == 'f') { i += 5; J j; j.t = J::B; j.bv = false; return j; }
  if (s[i] == 'n') { i += 4; return J(); }
  int st = i; while (i < (int)s.size() && (isdigit(s[i]) || s[i] == '.' || s[i] == '-' || s[i] == '+' || s[i] == 'e' || s[i] == 'E')) i++;
  J j; j.t = J::NUM; j.nv = stod(s.substr(st)); return j;
}
int toInt(const J& j) { return (int)j.nv; }
long long toLong(const J& j) { return (long long)j.nv; }
double toDouble(const J& j) { return j.nv; }
string toStr(const J& j) { return j.sv; }
bool toBool(const J& j) { return j.bv; }
char toChar(const J& j) { return j.sv.empty() ? (char)toInt(j) : j.sv[0]; }
vector<int> toIntArr(const J& j) { vector<int> r; for (auto& x : j.av) r.push_back(toInt(x)); return r; }
vector<long long> toLongArr(const J& j) { vector<long long> r; for (auto& x : j.av) r.push_back(toLong(x)); return r; }
vector<double> toDoubleArr(const J& j) { vector<double> r; for (auto& x : j.av) r.push_back(toDouble(x)); return r; }
vector<string> toStrArr(const J& j) { vector<string> r; for (auto& x : j.av) r.push_back(toStr(x)); return r; }
vector<bool> toBoolArr(const J& j) { vector<bool> r; for (auto& x : j.av) r.push_back(toBool(x)); return r; }
vector<char> toCharArr(const J& j) { vector<char> r; for (auto& x : j.av) r.push_back(toChar(x)); return r; }
string toJson(int v) { return to_string(v); }
string toJson(long long v) { return to_string(v); }
string toJson(double v) { return to_string(v); }
string toJson(const string& v) { string r = "\""; for (char c : v) { if (c == '"') r += "\\\""; else if (c == '\\') r += "\\\\"; else if (c == '\n') r += "\\n"; else if (c == '\r') r += "\\r"; else if (c == '\t') r += "\\t"; else r += c; } return r + "\""; }
string toJson(bool v) { return v ? "true" : "false"; }
string toJson(char v) { return "\"" + string(1, v) + "\""; }
string toJson(const vector<int>& v) { string r = "["; for (int i = 0; i < (int)v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } return r + "]"; }
string toJson(const vector<long long>& v) { string r = "["; for (int i = 0; i < (int)v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } return r + "]"; }
string toJson(const vector<double>& v) { string r = "["; for (int i = 0; i < (int)v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } return r + "]"; }
string toJson(const vector<string>& v) { string r = "["; for (int i = 0; i < (int)v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } return r + "]"; }
string toJson(const vector<bool>& v) { string r = "["; for (int i = 0; i < (int)v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } return r + "]"; }
string toJson(const vector<char>& v) { string r = "["; for (int i = 0; i < (int)v.size(); i++) { if (i) r += ","; r += toJson(string(1, v[i])); } return r + "]"; }
`;

const JAVA_PREAMBLE = String.raw`
  static String _s; static int _p;
  static void _ws() { while (_p < _s.length() && _s.charAt(_p) <= ' ') _p++; }
  static Object _p() throws Exception {
    _ws(); char c = _s.charAt(_p);
    if (c == '"') { _p++; StringBuilder b = new StringBuilder(); while (_p < _s.length() && _s.charAt(_p) != '"') { if (_s.charAt(_p) == '\\') { _p++; b.append(_p < _s.length() ? _s.charAt(_p) : ' '); } else b.append(_s.charAt(_p)); _p++; } _p++; return b.toString(); }
    if (c == '[') { _p++; java.util.ArrayList<Object> a = new java.util.ArrayList<>(); _ws(); if (_p < _s.length() && _s.charAt(_p) != ']') { while (true) { a.add(_p()); _ws(); if (_p >= _s.length() || _s.charAt(_p) != ',') break; _p++; } } _p++; return a; }
    if (c == 't') { _p += 4; return true; }
    if (c == 'f') { _p += 5; return false; }
    if (c == 'n') { _p += 4; return null; }
    int st = _p; while (_p < _s.length() && (_s.charAt(_p) >= '0' && _s.charAt(_p) <= '9' || _s.charAt(_p) == '.' || _s.charAt(_p) == '-' || _s.charAt(_p) == '+' || _s.charAt(_p) == 'e' || _s.charAt(_p) == 'E')) _p++;
    String num = _s.substring(st, _p); if (num.contains(".") || num.contains("e") || num.contains("E")) return Double.parseDouble(num);
    long v = Long.parseLong(num); if (v >= Integer.MIN_VALUE && v <= Integer.MAX_VALUE) return (int) v; return v;
  }
  static int toInt(Object o) { return ((Number) o).intValue(); }
  static long toLong(Object o) { return ((Number) o).longValue(); }
  static double toDouble(Object o) { return ((Number) o).doubleValue(); }
  static String toStr(Object o) { return (String) o; }
  static boolean toBool(Object o) { return (Boolean) o; }
  static char toChar(Object o) { return o instanceof String ? ((String) o).charAt(0) : (char)((Number) o).intValue(); }
  static int[] toIntArr(Object o) { java.util.List<?> l = (java.util.List<?>) o; int[] r = new int[l.size()]; for (int i = 0; i < l.size(); i++) r[i] = ((Number) l.get(i)).intValue(); return r; }
  static long[] toLongArr(Object o) { java.util.List<?> l = (java.util.List<?>) o; long[] r = new long[l.size()]; for (int i = 0; i < l.size(); i++) r[i] = ((Number) l.get(i)).longValue(); return r; }
  static double[] toDoubleArr(Object o) { java.util.List<?> l = (java.util.List<?>) o; double[] r = new double[l.size()]; for (int i = 0; i < l.size(); i++) r[i] = ((Number) l.get(i)).doubleValue(); return r; }
  static String[] toStrArr(Object o) { java.util.List<?> l = (java.util.List<?>) o; String[] r = new String[l.size()]; for (int i = 0; i < l.size(); i++) r[i] = (String) l.get(i); return r; }
  static boolean[] toBoolArr(Object o) { java.util.List<?> l = (java.util.List<?>) o; boolean[] r = new boolean[l.size()]; for (int i = 0; i < l.size(); i++) r[i] = (Boolean) l.get(i); return r; }
  static char[] toCharArr(Object o) { if (o instanceof String) return ((String) o).toCharArray(); java.util.List<?> l = (java.util.List<?>) o; char[] r = new char[l.size()]; for (int i = 0; i < l.size(); i++) r[i] = l.get(i) instanceof String ? ((String) l.get(i)).charAt(0) : (char)((Number) l.get(i)).intValue(); return r; }
  static String toJson(int v) { return String.valueOf(v); }
  static String toJson(long v) { return String.valueOf(v); }
  static String toJson(double v) { return String.valueOf(v); }
  static String toJson(String v) { return "\"" + v.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\""; }
  static String toJson(boolean v) { return v ? "true" : "false"; }
  static String toJson(char v) { return "\"" + v + "\""; }
  static String toJson(int[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(","); b.append(v[i]); } return b.append("]").toString(); }
  static String toJson(long[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(","); b.append(v[i]); } return b.append("]").toString(); }
  static String toJson(double[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(","); b.append(v[i]); } return b.append("]").toString(); }
  static String toJson(String[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(","); b.append(toJson(v[i])); } return b.append("]").toString(); }
  static String toJson(boolean[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(","); b.append(v[i]); } return b.append("]").toString(); }
  static String toJson(char[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(","); b.append(toJson(String.valueOf(v[i]))); } return b.append("]").toString(); }
`;

const C_PREAMBLE = String.raw`
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
typedef struct J { enum { JN, JB, JJ, JS, JA } t; int bv; double nv; char* sv; struct J* av; int al; } J;
J jnull(void) { J j; j.t = JN; return j; }
J jbool(int v) { J j; j.t = JB; j.bv = v; return j; }
J jnum(double v) { J j; j.t = JJ; j.nv = v; return j; }
J jstr(char* v) { J j; j.t = JS; j.sv = v; return j; }
J jarr(struct J* v, int l) { J j; j.t = JA; j.av = v; j.al = l; return j; }
void jfree(J j) { if (j.t == JS) free(j.sv); if (j.t == JA) { for (int i = 0; i < j.al; i++) jfree(j.av[i]); free(j.av); } }
J parseJ(const char* s, int* i) {
  while (s[*i] && s[*i] <= ' ') (*i)++;
  if (!s[*i]) return jnull();
  if (s[*i] == '"') { (*i)++; int st = *i; while (s[*i] && s[*i] != '"') { if (s[*i] == '\\') (*i)++; (*i)++; } int len = *i - st; char* b = malloc(len+1); memcpy(b, s+st, len); b[len]=0; (*i)++; return jstr(b); }
  if (s[*i] == '[') { (*i)++; int cap=4,n=0; J* a=malloc(cap*sizeof(J)); while(s[*i]&&s[*i]!=']'){ if(s[*i]==',')(*i)++; if(n>=cap){cap*=2;a=realloc(a,cap*sizeof(J));} a[n++]=parseJ(s,i); while(s[*i]&&(s[*i]==','||s[*i]<=' '))(*i)++; } if(s[*i]==']')(*i)++; return jarr(a,n); }
  if (s[*i]=='t'){(*i)+=4;return jbool(1);} if(s[*i]=='f'){(*i)+=5;return jbool(0);} if(s[*i]=='n'){(*i)+=4;return jnull();}
  int st=*i; while(s[*i]&&(isdigit(s[*i])||s[*i]=='.'||s[*i]=='-'||s[*i]=='+'||s[*i]=='e'||s[*i]=='E'))(*i)++; return jnum(strtod(s+st,NULL));
}
int toInt(J j){return(int)j.nv;} long toLong(J j){return(long)j.nv;} double toDouble(J j){return j.nv;} char* toStr(J j){return j.t==JS?j.sv:strdup("");} int toBool(J j){return j.t==JB?j.bv:(j.nv!=0);} char toChar(J j){if(j.t==JS&&j.sv[0])return j.sv[0];return(char)toInt(j);}
int* toIntArr(J j,int* l){if(j.t!=JA){*l=0;return NULL;}*l=j.al;int*r=malloc(j.al*sizeof(int));for(int i=0;i<j.al;i++)r[i]=toInt(j.av[i]);return r;}
long* toLongArr(J j,int* l){if(j.t!=JA){*l=0;return NULL;}*l=j.al;long*r=malloc(j.al*sizeof(long));for(int i=0;i<j.al;i++)r[i]=toLong(j.av[i]);return r;}
double* toDoubleArr(J j,int* l){if(j.t!=JA){*l=0;return NULL;}*l=j.al;double*r=malloc(j.al*sizeof(double));for(int i=0;i<j.al;i++)r[i]=toDouble(j.av[i]);return r;}
char** toStrArr(J j,int* l){if(j.t!=JA){*l=0;return NULL;}*l=j.al;char**r=malloc(j.al*sizeof(char*));for(int i=0;i<j.al;i++)r[i]=toStr(j.av[i]);return r;}
int* toBoolArr(J j,int* l){if(j.t!=JA){*l=0;return NULL;}*l=j.al;int*r=malloc(j.al*sizeof(int));for(int i=0;i<j.al;i++)r[i]=toBool(j.av[i]);return r;}
char* toCharArr(J j,int* l){if(j.t!=JA){*l=0;return NULL;}*l=j.al;char*r=malloc(j.al*sizeof(char));for(int i=0;i<j.al;i++)r[i]=toChar(j.av[i]);return r;}
void printJsonInt(int v){printf("%d",v);} void printJsonLong(long v){printf("%ld",v);} void printJsonDouble(double v){printf("%g",v);} void printJsonBool(int v){printf(v?"true":"false");} void printJsonChar(char v){printf("\"%c\"",v);} void printJsonNull(void){printf("null");}
void printJsonStr(const char* v){printf("\"%s\"",v);}
void printJsonIntArr(const int* v,int l){printf("[");for(int i=0;i<l;i++){if(i)printf(",");printf("%d",v[i]);}printf("]");}
void printJsonLongArr(const long* v,int l){printf("[");for(int i=0;i<l;i++){if(i)printf(",");printf("%ld",v[i]);}printf("]");}
void printJsonDoubleArr(const double* v,int l){printf("[");for(int i=0;i<l;i++){if(i)printf(",");printf("%g",v[i]);}printf("]");}
void printJsonStrArr(char*const* v,int l){printf("[");for(int i=0;i<l;i++){if(i)printf(",");printJsonStr(v[i]);}printf("]");}
void printJsonBoolArr(const int* v,int l){printf("[");for(int i=0;i<l;i++){if(i)printf(",");printf(v[i]?"true":"false");}printf("]");}
void printJsonCharArr(const char* v,int l){printf("[");for(int i=0;i<l;i++){if(i)printf(",");printf("\"%c\"",v[i]);}printf("]");}
`;

export function generateWrapper(functionSignature, language) {
  if (!functionSignature?.name) return '';
  const { name, returnType = 'void', params = [] } = functionSignature;

  if (language === 'javascript') {
    return `
const __stdin = require('fs').readFileSync(0, 'utf-8').trim();
if (__stdin) {
  const __args = JSON.parse(__stdin);
  const __result = ${name}(...__args);
  process.stdout.write(JSON.stringify(__result));
}
`.trimStart();
  }

  if (language === 'python') {
    return `
import json, sys
__stdin = sys.stdin.read().strip()
if __stdin:
    __args = json.loads(__stdin)
    __result = ${name}(*__args)
    print(json.dumps(__result))
`.trimStart();
  }

  if (language === 'cpp') {
    return cppWrapper(name, returnType, params);
  }

  if (language === 'c') {
    return cWrapper(name, returnType, params);
  }

  if (language === 'java') {
    return javaWrapper(name, returnType, params);
  }

  return '';
}

function cppWrapper(name, returnType, params) {
  const argDecls = params.map((p, i) => {
    const type = TYPE_INFO[p.type]?.cpp || 'auto';
    const conv = CONV_FN[p.type] || 'toInt';
    return `  ${type} arg${i} = ${conv}(args.av[${i}]);`;
  }).join('\n');

  const argList = params.map((_, i) => `arg${i}`).join(', ');

  let callLine;
  if (returnType === 'void') {
    callLine = `  ${name}(${argList});\n  cout << "null" << endl;`;
  } else {
    const retType = TYPE_INFO[returnType]?.cpp || 'auto';
    callLine = `  ${retType} result = ${name}(${argList});\n  cout << toJson(result) << endl;`;
  }

  return CPP_PREAMBLE + `\nint main() {\n  string line, input;\n  while (getline(cin, line)) input += line;\n  if (input.empty()) return 0;\n  int pos = 0;\n  J args = parseJ(input, pos);\n\n${argDecls}\n\n${callLine}\n  return 0;\n}\n`;
}

function javaWrapper(name, returnType, params) {
  const argDecls = params.map((p, i) => {
    const type = TYPE_INFO[p.type]?.java || 'Object';
    const conv = CONV_FN[p.type] || 'toInt';
    return `    ${type} arg${i} = ${conv}(a.get(${i}));`;
  }).join('\n');

  const argList = params.map((_, i) => `arg${i}`).join(', ');

  let callLine;
  if (returnType === 'void') {
    callLine = `    new Solution().${name}(${argList});\n    System.out.println("null");`;
  } else {
    const retType = TYPE_INFO[returnType]?.java || 'Object';
    callLine = `    ${retType} result = new Solution().${name}(${argList});\n    System.out.println(toJson(result));`;
  }

  return `class Main {\n${JAVA_PREAMBLE}\n  public static void main(String[] __a) throws Exception {\n    java.util.Scanner sc = new java.util.Scanner(System.in);\n    StringBuilder sb = new StringBuilder();\n    while (sc.hasNextLine()) sb.append(sc.nextLine());\n    _s = sb.toString().trim();\n    if (_s.isEmpty()) return;\n    _p = 0;\n    java.util.List<Object> a = (java.util.List<Object>) _p();\n\n${argDecls}\n\n${callLine}\n  }\n}\n`;
}

function cWrapper(name, returnType, params) {
  const argDecls = params.map((p, i) => {
    const type = C_TYPE_INFO[p.type] || 'int';
    const conv = C_CONV_FN[p.type] || 'toInt';
    if (type.endsWith('*')) {
      return `  int arg${i}_len;\n  ${type} arg${i} = ${conv}(args.av[${i}], &arg${i}_len);`;
    }
    return `  ${type} arg${i} = ${conv}(args.av[${i}]);`;
  }).join('\n');

  const argList = params.flatMap((p, i) => {
    const type = C_TYPE_INFO[p.type] || 'int';
    if (type.endsWith('*')) return [`arg${i}`, `arg${i}_len`];
    return [`arg${i}`];
  }).join(', ');

  let callLine;
  if (returnType === 'void') {
    callLine = `  ${name}(${argList});\n  printJsonNull();`;
  } else {
    const retType = C_TYPE_INFO[returnType] || 'int';
    const printFn = C_PRINT_FN[returnType] || 'printJsonInt';
    if (retType.endsWith('*')) {
      callLine = `  int result_len;\n  ${retType} result = ${name}(${argList});\n  ${printFn}(result, result_len);\n  free(result);`;
    } else {
      callLine = `  ${retType} result = ${name}(${argList});\n  ${printFn}(result);`;
    }
  }

  return C_PREAMBLE + `\nint main() {\n  char line[1024]; char input[65536] = ""; size_t input_len = 0;\n  while (fgets(line, sizeof(line), stdin)) {\n    size_t line_len = strlen(line);\n    if (input_len + line_len + 1 > sizeof(input)) break;\n    memcpy(input + input_len, line, line_len + 1);\n    input_len += line_len;\n  }\n  if (!input_len) return 0;\n  int pos = 0;\n  J args = parseJ(input, &pos);\n\n${argDecls}\n\n${callLine}\n  jfree(args);\n  return 0;\n}\n`;
}
