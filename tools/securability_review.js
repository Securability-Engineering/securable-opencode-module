#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  clamp,
  listFilesRecursively,
  normalizeWorkspaceRoot,
  readJsonFromStdin,
  writeJson
} = require("./lib/common");

const CODE_EXTENSIONS = new Set([
  ".js", ".ts", ".tsx", ".py", ".java", ".cs", ".go", ".rs", ".cpp", ".c", ".rb", ".php"
]);

const LANGUAGE_BY_EXTENSION = {
  ".js": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".java": "java",
  ".cs": "csharp",
  ".go": "go",
  ".rs": "rust",
  ".cpp": "cpp",
  ".c": "c",
  ".rb": "ruby",
  ".php": "php"
};

const LANGUAGE_PATTERNS = {
  javascript: {
    functionDecl: /\bfunction\b|=>|\basync\b/g,
    classDecl: /\bclass\b/g,
    validationHint: /\b(validate|sanitize|schema|zod|joi|validator)\b/ig,
    authHint: /\b(auth|jwt|oauth|session|mfa)\b/ig,
    errorHint: /\btry\b|\bcatch\b|\bthrow\b/ig
  },
  typescript: {
    functionDecl: /\bfunction\b|=>|\basync\b/g,
    classDecl: /\bclass\b|\binterface\b/g,
    validationHint: /\b(validate|sanitize|schema|zod|joi|validator)\b/ig,
    authHint: /\b(auth|jwt|oauth|session|mfa)\b/ig,
    errorHint: /\btry\b|\bcatch\b|\bthrow\b/ig
  },
  python: {
    functionDecl: /\bdef\b|\blambda\b/g,
    classDecl: /\bclass\b/g,
    validationHint: /\b(validate|sanitize|pydantic|schema)\b/ig,
    authHint: /\b(auth|jwt|oauth|session|mfa)\b/ig,
    errorHint: /\btry\b|\bexcept\b|\braise\b/ig
  },
  java: {
    functionDecl: /\b(public|private|protected)\b[^\n]*\(/g,
    classDecl: /\bclass\b|\binterface\b/g,
    validationHint: /\b(validate|sanitize|validator|constraint)\b/ig,
    authHint: /\b(auth|oauth|jwt|session)\b/ig,
    errorHint: /\btry\b|\bcatch\b|\bthrow\b/ig
  },
  csharp: {
    functionDecl: /\b(public|private|protected|internal)\b[^\n]*\(/g,
    classDecl: /\bclass\b|\binterface\b/g,
    validationHint: /\b(validate|sanitize|fluentvalidation|dataannotations)\b/ig,
    authHint: /\b(auth|oauth|jwt|identity|claims)\b/ig,
    errorHint: /\btry\b|\bcatch\b|\bthrow\b/ig
  },
  go: {
    functionDecl: /\bfunc\b/g,
    classDecl: /\btype\b\s+\w+\s+struct\b/g,
    validationHint: /\b(validate|sanitize|binding|schema)\b/ig,
    authHint: /\b(auth|jwt|oauth|session)\b/ig,
    errorHint: /\bif\s+err\s*!?=\s*nil\b|\bpanic\b/g
  },
  rust: {
    functionDecl: /\bfn\b/g,
    classDecl: /\bstruct\b|\benum\b|\btrait\b/g,
    validationHint: /\b(validate|sanitize|serde|schema)\b/ig,
    authHint: /\b(auth|jwt|oauth|session)\b/ig,
    errorHint: /\bResult<|\bpanic!\b|\bmatch\b/ig
  }
};

function isCodeFile(filePath) {
  return CODE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function mean(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function matchCount(content, regex) {
  if (!regex) {
    return 0;
  }

  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] || "other";
}

function scoreFromHeuristics(stats) {
  const locPenalty = Math.min(4, stats.avgLinesPerFile / 180);
  const longFnPenalty = Math.min(3, stats.longLineRatio * 10);
  const testBonus = Math.min(2, stats.testFileRatio * 8);

  const analyzability = clamp(8.8 - locPenalty - longFnPenalty, 2, 10);
  const modifiability = clamp(7.8 - Math.min(2, stats.importDensity) + testBonus * 0.4, 2, 10);
  const testability = clamp(5.5 + testBonus - Math.min(1.5, stats.avgLinesPerFile / 240), 1, 10);

  const confidentiality = clamp(6.5 - stats.secretPatternHits * 0.6, 1, 10);
  const accountability = clamp(5.5 + Math.min(2, stats.logHintRatio * 6), 1, 10);
  const authenticity = clamp(6.2 + Math.min(1.8, stats.authHintRatio * 8) - stats.secretPatternHits * 0.2, 1, 10);

  const availability = clamp(6.0 + Math.min(1.5, stats.errorHandlingRatio * 8), 1, 10);
  const integrity = clamp(6.0 + Math.min(2.0, stats.validationHintRatio * 10) - stats.rawQueryHits * 0.3, 1, 10);
  const resilience = clamp(6.0 + Math.min(2.0, stats.errorHandlingRatio * 9), 1, 10);

  return {
    maintainability: {
      analyzability,
      modifiability,
      testability,
      score: 0.4 * analyzability + 0.3 * modifiability + 0.3 * testability
    },
    trustworthiness: {
      confidentiality,
      accountability,
      authenticity,
      score: 0.35 * confidentiality + 0.3 * accountability + 0.35 * authenticity
    },
    reliability: {
      availability,
      integrity,
      resilience,
      score: 0.25 * availability + 0.35 * integrity + 0.4 * resilience
    }
  };
}

function grade(score) {
  if (score >= 9) return "Excellent";
  if (score >= 8) return "Good";
  if (score >= 7) return "Adequate";
  if (score >= 6) return "Fair";
  return "Poor";
}

function run(input) {
  const workspaceRoot = normalizeWorkspaceRoot(input.workspaceRoot);
  const target = path.resolve(workspaceRoot, input.targetPath || ".");

  if (!fs.existsSync(target)) {
    return {
      ok: false,
      error: {
        code: "TARGET_NOT_FOUND",
        message: `Target path does not exist: ${target}`
      }
    };
  }

  const stat = fs.statSync(target);
  const files = stat.isDirectory()
    ? listFilesRecursively(target, isCodeFile)
    : (isCodeFile(target) ? [target] : []);

  if (files.length === 0) {
    return {
      ok: false,
      error: {
        code: "NO_CODE_FILES",
        message: "No supported code files found in the target scope."
      }
    };
  }

  const fileLineCounts = [];
  const languageStats = {};
  let totalLines = 0;
  let longLineCount = 0;
  let importCount = 0;
  let testFiles = 0;
  let secretPatternHits = 0;
  let logHints = 0;
  let authHints = 0;
  let validationHints = 0;
  let errorHints = 0;
  let rawQueryHits = 0;

  const secretRegex = /(api[_-]?key|secret|password|token)\s*[=:]/ig;
  const logRegex = /(log\.|logger\.|audit|trace|console\.log)/ig;
  const authRegex = /(auth|jwt|session|oauth|mfa|identity)/ig;
  const validationRegex = /(validate|sanitize|canonical|schema|zod|joi)/ig;
  const errorRegex = /(try\s*\{|catch\s*\(|except\s+|throw\s+|raise\s+)/ig;
  const rawQueryRegex = /(SELECT\s+.+\+|query\s*\(|execute\s*\()/ig;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    totalLines += lines.length;
    fileLineCounts.push(lines.length);

    const language = getLanguage(file);
    if (!languageStats[language]) {
      languageStats[language] = {
        files: 0,
        lines: 0,
        functionDecls: 0,
        classDecls: 0,
        validationHints: 0,
        authHints: 0,
        errorHandlingHints: 0
      };
    }

    languageStats[language].files += 1;
    languageStats[language].lines += lines.length;

    const patterns = LANGUAGE_PATTERNS[language];
    if (patterns) {
      languageStats[language].functionDecls += matchCount(content, patterns.functionDecl);
      languageStats[language].classDecls += matchCount(content, patterns.classDecl);
      languageStats[language].validationHints += matchCount(content, patterns.validationHint);
      languageStats[language].authHints += matchCount(content, patterns.authHint);
      languageStats[language].errorHandlingHints += matchCount(content, patterns.errorHint);
    }

    if (/test|spec/i.test(path.basename(file))) {
      testFiles += 1;
    }

    for (const line of lines) {
      if (line.length > 130) {
        longLineCount += 1;
      }
      if (/^\s*(import\s|from\s.+\simport\s|using\s|#include\s)/.test(line)) {
        importCount += 1;
      }

      if (secretRegex.test(line)) secretPatternHits += 1;
      if (logRegex.test(line)) logHints += 1;
      if (authRegex.test(line)) authHints += 1;
      if (validationRegex.test(line)) validationHints += 1;
      if (errorRegex.test(line)) errorHints += 1;
      if (rawQueryRegex.test(line)) rawQueryHits += 1;

      secretRegex.lastIndex = 0;
      logRegex.lastIndex = 0;
      authRegex.lastIndex = 0;
      validationRegex.lastIndex = 0;
      errorRegex.lastIndex = 0;
      rawQueryRegex.lastIndex = 0;
    }
  }

  const avgLinesPerFile = mean(fileLineCounts);
  const totalFunctions = Object.values(languageStats).reduce((sum, value) => sum + value.functionDecls, 0);
  const totalClasses = Object.values(languageStats).reduce((sum, value) => sum + value.classDecls, 0);
  const languageCount = Object.keys(languageStats).length;
  const stats = {
    filesAnalyzed: files.length,
    languagesDetected: languageCount,
    avgLinesPerFile,
    totalLines,
    totalFunctions,
    totalClasses,
    longLineRatio: longLineCount / Math.max(1, totalLines),
    importDensity: importCount / Math.max(1, files.length),
    testFileRatio: testFiles / Math.max(1, files.length),
    secretPatternHits,
    logHintRatio: logHints / Math.max(1, totalLines),
    authHintRatio: authHints / Math.max(1, totalLines),
    validationHintRatio: validationHints / Math.max(1, totalLines),
    errorHandlingRatio: errorHints / Math.max(1, totalLines),
    rawQueryHits
  };

  const pillars = scoreFromHeuristics(stats);
  const overall = (pillars.maintainability.score + pillars.trustworthiness.score + pillars.reliability.score) / 3;

  return {
    ok: true,
    scope: {
      workspaceRoot,
      targetPath: target,
      filesAnalyzed: files.length
    },
    ssem: {
      overallScore: Number(overall.toFixed(2)),
      grade: grade(overall),
      pillars: {
        maintainability: {
          score: Number(pillars.maintainability.score.toFixed(2)),
          analyzability: Number(pillars.maintainability.analyzability.toFixed(2)),
          modifiability: Number(pillars.maintainability.modifiability.toFixed(2)),
          testability: Number(pillars.maintainability.testability.toFixed(2))
        },
        trustworthiness: {
          score: Number(pillars.trustworthiness.score.toFixed(2)),
          confidentiality: Number(pillars.trustworthiness.confidentiality.toFixed(2)),
          accountability: Number(pillars.trustworthiness.accountability.toFixed(2)),
          authenticity: Number(pillars.trustworthiness.authenticity.toFixed(2))
        },
        reliability: {
          score: Number(pillars.reliability.score.toFixed(2)),
          availability: Number(pillars.reliability.availability.toFixed(2)),
          integrity: Number(pillars.reliability.integrity.toFixed(2)),
          resilience: Number(pillars.reliability.resilience.toFixed(2))
        }
      }
    },
    heuristics: stats,
    languageBreakdown: languageStats,
    analyzer: {
      mode: "language-aware-static-analysis",
      version: "2.0"
    },
    reportTemplate: {
      finding: "../templates/finding.md",
      report: "../templates/report.md"
    },
    limitations: [
      "Scores are heuristic and should be validated with manual engineering review.",
      "This tool estimates attribute posture from static text signals and code shape."
    ]
  };
}

if (require.main === module) {
  writeJson(run(readJsonFromStdin()));
}

module.exports = { run };
