import ts from "typescript";
import { stripLegacyToolExports } from "./custom-tool-source.js";

type JsonSchemaProperty = {
  type: string;
  minLength?: number;
  enum?: string[];
};

function unionTypeNodeToPropertySchema(union: ts.UnionTypeNode): JsonSchemaProperty | null {
  const members = union.types.filter(
    (t) => t.kind !== ts.SyntaxKind.UndefinedKeyword && t.kind !== ts.SyntaxKind.NullKeyword,
  );
  if (members.length === 0) return null;

  const stringLiterals: string[] = [];
  for (const member of members) {
    if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
      stringLiterals.push(member.literal.text);
      continue;
    }
    return null;
  }

  const unique = [...new Set(stringLiterals)];
  return { type: "string", enum: unique, minLength: 1 };
}

function typeNodeToPropertySchema(typeNode: ts.TypeNode): JsonSchemaProperty | null {
  if (ts.isUnionTypeNode(typeNode)) {
    return unionTypeNodeToPropertySchema(typeNode);
  }
  switch (typeNode.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { type: "string", minLength: 1 };
    case ts.SyntaxKind.NumberKeyword:
      return { type: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { type: "boolean" };
    default:
      break;
  }
  if (ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal)) {
    return { type: "string", minLength: 1 };
  }
  return null;
}

function findExecuteFunction(sourceFile: ts.SourceFile): ts.FunctionDeclaration | null {
  let found: ts.FunctionDeclaration | null = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "execute" &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

export function inferCustomToolInputSchema(
  source: string,
): { ok: true; inputSchema: Record<string, unknown> } | { ok: false; error: string } {
  const normalized = stripLegacyToolExports(source);
  const sourceFile = ts.createSourceFile(
    "custom-tool.ts",
    normalized,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const executeFn = findExecuteFunction(sourceFile);
  if (!executeFn) {
    return { ok: false, error: "Source must export async function execute." };
  }

  const inputParam = executeFn.parameters[0];
  if (!inputParam?.type || !ts.isTypeLiteralNode(inputParam.type)) {
    return {
      ok: false,
      error: "execute must declare input as an inline object type, e.g. input: { location: string }.",
    };
  }

  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const member of inputParam.type.members) {
    if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
    const key = member.name.text;
    if (!member.type) {
      return { ok: false, error: `Input property "${key}" must have a type annotation.` };
    }
    const propSchema = typeNodeToPropertySchema(member.type);
    if (!propSchema) {
      return {
        ok: false,
        error: `Unsupported input type for "${key}". Use string, number, boolean, or string literal unions (e.g. "A" | "B").`,
      };
    }
    properties[key] = propSchema;
    if (!member.questionToken) {
      required.push(key);
    }
  }

  if (required.length === 0) {
    return { ok: false, error: "execute input must include at least one required property." };
  }

  return {
    ok: true,
    inputSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}
