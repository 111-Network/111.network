/**
 * Read the literal constants of src/lib/site.ts without compiling it, so the
 * build scripts (check-copy, check-install) use the same values as the page.
 *
 * Supported: `export const NAME[: T] = <literal>` where <literal> is a string,
 * template without substitutions, number, boolean, or an object literal of
 * those (`as const` / `satisfies` / parentheses are unwrapped). For
 * `a ?? "x"` / `a || "x"` the right-hand literal (the default) is used.
 * Anything else is left out.
 */
import ts from "typescript"

function unwrap(node) {
  let n = node
  while (n && (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n) || ts.isTypeAssertionExpression(n))) {
    n = n.expression
  }
  return n
}

function literalValue(node) {
  const n = unwrap(node)
  if (!n) return undefined
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text
  if (ts.isNumericLiteral(n)) return Number(n.text)
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
    return literalValue(n.right)
  }
  if (ts.isObjectLiteralExpression(n)) {
    const out = {}
    for (const prop of n.properties) {
      if (!ts.isPropertyAssignment(prop)) return undefined
      const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined
      const value = literalValue(prop.initializer)
      if (key === undefined || value === undefined || typeof value === "object") return undefined
      out[key] = value
    }
    return out
  }
  return undefined
}

/** Exported literal constants of one TS module, as { NAME: value }. */
export function readSiteConstants(code, fileName = "site.ts") {
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const out = {}
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue
    if (!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    if (!(stmt.declarationList.flags & ts.NodeFlags.Const)) continue
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
      const value = literalValue(decl.initializer)
      if (value !== undefined) out[decl.name.text] = value
    }
  }
  return out
}
