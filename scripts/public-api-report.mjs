import ts from "typescript";

/** Read declarations through the same export symbols consumed by TypeScript Hosts. */
export function publicApiReport(entries) {
  const program = ts.createProgram(Object.values(entries), {
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ removeComments: true });
  return Object.fromEntries(
    Object.entries(entries)
      .sort()
      .map(([subpath, file]) => {
        const source = program.getSourceFile(file);
        const module = source && checker.getSymbolAtLocation(source);
        if (!module)
          throw new Error(`Cannot read public declarations: ${subpath}.`);
        return [
          subpath,
          Object.fromEntries(
            checker
              .getExportsOfModule(module)
              .sort((a, b) => a.name.localeCompare(b.name, "en"))
              .map((symbol) => {
                const target =
                  symbol.flags & ts.SymbolFlags.Alias
                    ? checker.getAliasedSymbol(symbol)
                    : symbol;
                const declarations = target.getDeclarations();
                if (!declarations?.length)
                  throw new Error(
                    `Unresolved public export: ${subpath}/${symbol.name}.`,
                  );
                return [
                  symbol.name,
                  declarations.map((declaration) =>
                    printer
                      .printNode(
                        ts.EmitHint.Unspecified,
                        declaration,
                        declaration.getSourceFile(),
                      )
                      .trim(),
                  ),
                ];
              }),
          ),
        ];
      }),
  );
}
