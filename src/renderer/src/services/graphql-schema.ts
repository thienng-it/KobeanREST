// GraphQL Schema Service for KobeanREST
// Handles full schema introspection, SDL conversion (JSON <-> SDL),
// SDL parsing, query generation from schema fields, and autocompletion.

export interface GraphQLTypeRef {
  kind: string;
  name?: string | null;
  ofType?: GraphQLTypeRef | null;
}

export interface GraphQLFieldArg {
  name: string;
  description?: string | null;
  type: GraphQLTypeRef;
  defaultValue?: string | null;
}

export interface GraphQLField {
  name: string;
  description?: string | null;
  args: GraphQLFieldArg[];
  type: GraphQLTypeRef;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface GraphQLInputValue {
  name: string;
  description?: string | null;
  type: GraphQLTypeRef;
  defaultValue?: string | null;
}

export interface GraphQLEnumValue {
  name: string;
  description?: string | null;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface GraphQLType {
  kind: "OBJECT" | "INPUT_OBJECT" | "ENUM" | "SCALAR" | "INTERFACE" | "UNION";
  name: string;
  description?: string | null;
  fields?: GraphQLField[] | null;
  inputFields?: GraphQLInputValue[] | null;
  interfaces?: Array<{ name: string; kind: string }> | null;
  enumValues?: GraphQLEnumValue[] | null;
  possibleTypes?: Array<{ name: string; kind: string }> | null;
}

export interface GraphQLSchemaData {
  queryType?: { name: string } | null;
  mutationType?: { name: string } | null;
  subscriptionType?: { name: string } | null;
  types: GraphQLType[];
  directives?: Array<{
    name: string;
    description?: string | null;
    locations: string[];
    args: GraphQLFieldArg[];
  }> | null;
}

/**
 * Full standard GraphQL Introspection query.
 */
export const FULL_INTROSPECTION_QUERY = `query FullIntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      description
      fields(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
        args {
          name
          description
          defaultValue
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
      inputFields {
        name
        description
        defaultValue
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
      interfaces {
        kind
        name
      }
      enumValues(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        kind
        name
      }
    }
    directives {
      name
      description
      locations
      args {
        name
        description
        defaultValue
        type {
          kind
          name
          ofType {
            kind
            name
          }
        }
      }
    }
  }
}`;

/**
 * Recursively formats a GraphQL Type reference to SDL format (e.g. [User!]!, String, Int!).
 */
export function formatTypeRef(typeRef?: GraphQLTypeRef | null): string {
  if (!typeRef) return "Unknown";
  if (typeRef.kind === "NON_NULL") {
    return `${formatTypeRef(typeRef.ofType)}!`;
  }
  if (typeRef.kind === "LIST") {
    return `[${formatTypeRef(typeRef.ofType)}]`;
  }
  return typeRef.name || "Unknown";
}

/**
 * Extracts base type name (unwraps NON_NULL and LIST).
 */
export function getBaseTypeName(typeRef?: GraphQLTypeRef | null): string {
  if (!typeRef) return "";
  if (typeRef.ofType) return getBaseTypeName(typeRef.ofType);
  return typeRef.name || "";
}

/**
 * Converts a full GraphQL introspection response object or __schema into formatted SDL text.
 */
export function introspectionToSDL(schemaData: any): string {
  const schema: GraphQLSchemaData = schemaData.__schema || schemaData.data?.__schema || schemaData;
  if (!schema || !Array.isArray(schema.types)) {
    return "# Invalid schema data: types array missing";
  }

  const lines: string[] = [];

  // Schema definition block
  const hasCustomQuery = schema.queryType && schema.queryType.name !== "Query";
  const hasMutation = !!schema.mutationType;
  const hasSubscription = !!schema.subscriptionType;

  if (hasCustomQuery || hasMutation || hasSubscription) {
    lines.push("schema {");
    if (schema.queryType?.name) lines.push(`  query: ${schema.queryType.name}`);
    if (schema.mutationType?.name) lines.push(`  mutation: ${schema.mutationType.name}`);
    if (schema.subscriptionType?.name) lines.push(`  subscription: ${schema.subscriptionType.name}`);
    lines.push("}");
    lines.push("");
  }

  // Filter out internal types starting with '__'
  const userTypes = schema.types.filter((t) => !t.name.startsWith("__"));

  // Sort: Queries/Mutations/Subscriptions first, then Objects, Interfaces, Unions, Inputs, Enums, Scalars
  userTypes.sort((a, b) => {
    const isRootA = a.name === schema.queryType?.name || a.name === schema.mutationType?.name || a.name === schema.subscriptionType?.name;
    const isRootB = b.name === schema.queryType?.name || b.name === schema.mutationType?.name || b.name === schema.subscriptionType?.name;
    if (isRootA && !isRootB) return -1;
    if (!isRootA && isRootB) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const type of userTypes) {
    if (type.description) {
      lines.push(`"""\n${type.description.trim()}\n"""`);
    }

    switch (type.kind) {
      case "SCALAR":
        // Skip default built-in scalars if they have no custom description
        if (["Int", "Float", "String", "Boolean", "ID"].includes(type.name)) {
          continue;
        }
        lines.push(`scalar ${type.name}`);
        lines.push("");
        break;

      case "OBJECT": {
        const implementsClause = type.interfaces && type.interfaces.length > 0
          ? ` implements ${type.interfaces.map((i) => i.name).join(" & ")}`
          : "";
        lines.push(`type ${type.name}${implementsClause} {`);
        if (type.fields && type.fields.length > 0) {
          for (const field of type.fields) {
            if (field.description) {
              lines.push(`  """${field.description.trim()}"""`);
            }
            const args = field.args && field.args.length > 0
              ? `(${field.args.map((a) => `${a.name}: ${formatTypeRef(a.type)}${a.defaultValue ? ` = ${a.defaultValue}` : ""}`).join(", ")})`
              : "";
            const deprecation = field.isDeprecated ? ` @deprecated(reason: ${JSON.stringify(field.deprecationReason || "No reason given")})` : "";
            lines.push(`  ${field.name}${args}: ${formatTypeRef(field.type)}${deprecation}`);
          }
        }
        lines.push("}");
        lines.push("");
        break;
      }

      case "INTERFACE": {
        lines.push(`interface ${type.name} {`);
        if (type.fields && type.fields.length > 0) {
          for (const field of type.fields) {
            if (field.description) {
              lines.push(`  """${field.description.trim()}"""`);
            }
            const args = field.args && field.args.length > 0
              ? `(${field.args.map((a) => `${a.name}: ${formatTypeRef(a.type)}`).join(", ")})`
              : "";
            lines.push(`  ${field.name}${args}: ${formatTypeRef(field.type)}`);
          }
        }
        lines.push("}");
        lines.push("");
        break;
      }

      case "UNION": {
        const types = type.possibleTypes ? type.possibleTypes.map((t) => t.name).join(" | ") : "";
        lines.push(`union ${type.name} = ${types}`);
        lines.push("");
        break;
      }

      case "ENUM": {
        lines.push(`enum ${type.name} {`);
        if (type.enumValues && type.enumValues.length > 0) {
          for (const val of type.enumValues) {
            if (val.description) {
              lines.push(`  """${val.description.trim()}"""`);
            }
            const deprecation = val.isDeprecated ? ` @deprecated(reason: ${JSON.stringify(val.deprecationReason || "")})` : "";
            lines.push(`  ${val.name}${deprecation}`);
          }
        }
        lines.push("}");
        lines.push("");
        break;
      }

      case "INPUT_OBJECT": {
        lines.push(`input ${type.name} {`);
        if (type.inputFields && type.inputFields.length > 0) {
          for (const field of type.inputFields) {
            if (field.description) {
              lines.push(`  """${field.description.trim()}"""`);
            }
            const defVal = field.defaultValue ? ` = ${field.defaultValue}` : "";
            lines.push(`  ${field.name}: ${formatTypeRef(field.type)}${defVal}`);
          }
        }
        lines.push("}");
        lines.push("");
        break;
      }
    }
  }

  return lines.join("\n").trim();
}

/**
 * Parses raw GraphQL SDL text into a schema representation for explorer and autocomplete.
 */
export function parseSDLToSchema(sdl: string): GraphQLSchemaData {
  const types: GraphQLType[] = [];
  let queryTypeName = "Query";
  let mutationTypeName = "Mutation";
  let subscriptionTypeName = "Subscription";

  // Match type/interface/input/enum/union/scalar blocks
  const blockRegex = /(?:"""([\s\S]*?)"""\s*)?(type|interface|input|enum|union|scalar|schema)\s+([A-Za-z0-9_]+)?(?:\s+implements\s+([^{]+))?(?:\s*=\s*([^\{\n]+))?(?:\s*\{([^}]*)\})?/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(sdl)) !== null) {
    const description = match[1]?.trim() || null;
    const kindKeyword = match[2];
    const name = match[3] || "";
    const implementsRaw = match[4];
    const unionTypesRaw = match[5];
    const body = match[6] || "";

    if (kindKeyword === "schema") {
      const qMatch = body.match(/query:\s*([A-Za-z0-9_]+)/);
      const mMatch = body.match(/mutation:\s*([A-Za-z0-9_]+)/);
      const sMatch = body.match(/subscription:\s*([A-Za-z0-9_]+)/);
      if (qMatch) queryTypeName = qMatch[1];
      if (mMatch) mutationTypeName = mMatch[1];
      if (sMatch) subscriptionTypeName = sMatch[1];
      continue;
    }

    if (!name) continue;

    if (kindKeyword === "scalar") {
      types.push({ kind: "SCALAR", name, description });
    } else if (kindKeyword === "union") {
      const possibleTypes = unionTypesRaw
        ? unionTypesRaw.split("|").map((t) => ({ name: t.trim(), kind: "OBJECT" }))
        : [];
      types.push({ kind: "UNION", name, description, possibleTypes });
    } else if (kindKeyword === "enum") {
      const enumValues: GraphQLEnumValue[] = [];
      const lines = body.split("\n");
      for (const line of lines) {
        const cleaned = line.replace(/#.*$/, "").trim();
        if (cleaned) {
          const valMatch = cleaned.match(/^([A-Za-z0-9_]+)/);
          if (valMatch) enumValues.push({ name: valMatch[1] });
        }
      }
      types.push({ kind: "ENUM", name, description, enumValues });
    } else if (kindKeyword === "input") {
      const inputFields: GraphQLInputValue[] = [];
      const fieldLines = body.split("\n");
      for (const line of fieldLines) {
        const cleaned = line.replace(/#.*$/, "").trim();
        const fMatch = cleaned.match(/^([A-Za-z0-9_]+)\s*:\s*([^=\n]+)/);
        if (fMatch) {
          inputFields.push({
            name: fMatch[1],
            type: { kind: "NAMED", name: fMatch[2].trim() },
          });
        }
      }
      types.push({ kind: "INPUT_OBJECT", name, description, inputFields });
    } else if (kindKeyword === "type" || kindKeyword === "interface") {
      const fields: GraphQLField[] = [];
      const fieldLines = body.split("\n");
      for (const line of fieldLines) {
        const cleaned = line.replace(/#.*$/, "").trim();
        const fMatch = cleaned.match(/^([A-Za-z0-9_]+)(?:\(([^)]*)\))?\s*:\s*([^@\n]+)/);
        if (fMatch) {
          const fName = fMatch[1];
          const argsRaw = fMatch[2];
          const typeStr = fMatch[3].trim();
          const args: GraphQLFieldArg[] = [];

          if (argsRaw) {
            for (const argItem of argsRaw.split(",")) {
              const aMatch = argItem.trim().match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
              if (aMatch) {
                args.push({
                  name: aMatch[1],
                  type: { kind: "NAMED", name: aMatch[2].trim() },
                });
              }
            }
          }

          fields.push({
            name: fName,
            args,
            type: { kind: "NAMED", name: typeStr },
          });
        }
      }

      types.push({
        kind: kindKeyword === "interface" ? "INTERFACE" : "OBJECT",
        name,
        description,
        fields,
        interfaces: implementsRaw ? implementsRaw.split("&").map((i) => ({ name: i.trim(), kind: "INTERFACE" })) : [],
      });
    }
  }

  return {
    queryType: { name: queryTypeName },
    mutationType: { name: mutationTypeName },
    subscriptionType: { name: subscriptionTypeName },
    types,
  };
}

/**
 * Automatically builds a GraphQL Query/Mutation document and matching variable dictionary from a schema field.
 */
export function generateOperationForField(
  operationType: "query" | "mutation" | "subscription",
  field: GraphQLField,
  schemaTypes: GraphQLType[]
): { query: string; variables: string } {
  const opName = operationType === "mutation" ? "ExecuteMutation" : operationType === "subscription" ? "OnEvent" : "FetchData";
  const hasArgs = field.args && field.args.length > 0;

  let opHeader = `${operationType} ${opName}`;
  let fieldCall = field.name;
  const variableDict: Record<string, any> = {};

  if (hasArgs) {
    const varDefs = field.args.map((a) => `$${a.name}: ${formatTypeRef(a.type)}`).join(", ");
    opHeader += `(${varDefs})`;

    const callArgs = field.args.map((a) => `${a.name}: $${a.name}`).join(", ");
    fieldCall += `(${callArgs})`;

    for (const a of field.args) {
      const base = getBaseTypeName(a.type);
      if (base === "Int") variableDict[a.name] = 10;
      else if (base === "Float") variableDict[a.name] = 1.0;
      else if (base === "Boolean") variableDict[a.name] = true;
      else if (base === "ID" || base === "String") variableDict[a.name] = `sample_${a.name}`;
      else variableDict[a.name] = {};
    }
  }

  // Find return type and generate subfields if OBJECT or LIST of OBJECT
  const returnBaseName = getBaseTypeName(field.type);
  const targetType = schemaTypes.find((t) => t.name === returnBaseName);

  let selection = "";
  if (targetType && targetType.kind === "OBJECT" && targetType.fields && targetType.fields.length > 0) {
    // Pick scalar fields or first few fields
    const subFields = targetType.fields
      .filter((f) => {
        const base = getBaseTypeName(f.type);
        return ["String", "Int", "Float", "Boolean", "ID"].includes(base) || !f.args || f.args.length === 0;
      })
      .slice(0, 5)
      .map((f) => `    ${f.name}`);

    if (subFields.length > 0) {
      selection = ` {\n${subFields.join("\n")}\n  }`;
    } else {
      selection = ` {\n    __typename\n  }`;
    }
  }

  const queryDoc = `${opHeader} {\n  ${fieldCall}${selection}\n}`;
  const varsDoc = JSON.stringify(variableDict, null, 2);

  return { query: queryDoc, variables: varsDoc };
}

/**
 * Creates context-aware CodeMirror completions for GraphQL queries based on schema types.
 */
export function getGraphQLSchemaCompletionSource(schemaTypes: GraphQLType[]) {
  return (context: any) => {
    const word = context.matchBefore(/[A-Za-z0-9_]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const keywords = [
      { label: "query", type: "keyword", detail: "GraphQL Query" },
      { label: "mutation", type: "keyword", detail: "GraphQL Mutation" },
      { label: "subscription", type: "keyword", detail: "GraphQL Subscription" },
      { label: "fragment", type: "keyword", detail: "GraphQL Fragment" },
      { label: "__typename", type: "property", detail: "Meta Typename" },
      { label: "__schema", type: "property", detail: "Introspection Root" },
    ];

    const typeCompletions: any[] = [];
    for (const t of schemaTypes) {
      if (t.name.startsWith("__")) continue;

      if (t.fields) {
        for (const f of t.fields) {
          typeCompletions.push({
            label: f.name,
            type: "property",
            detail: `${t.name}.${f.name}: ${formatTypeRef(f.type)}`,
            info: f.description || undefined,
          });

          if (f.args) {
            for (const a of f.args) {
              typeCompletions.push({
                label: `${a.name}: `,
                type: "variable",
                detail: `Argument: ${formatTypeRef(a.type)}`,
                info: a.description || undefined,
              });
            }
          }
        }
      }

      typeCompletions.push({
        label: t.name,
        type: "type",
        detail: `GraphQL ${t.kind}`,
        info: t.description || undefined,
      });
    }

    // Deduplicate options by label
    const seen = new Set<string>();
    const options: any[] = [];
    for (const opt of [...keywords, ...typeCompletions]) {
      if (!seen.has(opt.label)) {
        seen.add(opt.label);
        options.push(opt);
      }
    }

    return {
      from: word.from,
      options,
    };
  };
}
