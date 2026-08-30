module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-does-not-import-ui",
      severity: "error",
      from: { path: "^app/(domain|sources|webmcp)/" },
      to: { path: "^app/components/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { exportsFields: ["exports"] },
  },
};
