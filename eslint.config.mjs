import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/immutability": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "react-hooks/exhaustive-deps": "off",
      "prefer-const": "off"
    }
  },
  // Override default ignores of eslint-config-next.
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.mjs"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/automationCore", "**/automationCore.ts", "@/lib/automation/automationCore", ".*automationCore.*"],
          message: "automationCore is restricted to strictly permitted wrappers only."
        }]
      }],
      "no-restricted-syntax": ["error",
        {
          "selector": "CallExpression[callee.name='require'][arguments.0.value=/.*automationCore.*/]",
          "message": "automationCore is restricted to strictly permitted wrappers only."
        },
        {
          "selector": "ImportExpression[source.value=/.*automationCore.*/]",
          "message": "automationCore is restricted to strictly permitted wrappers only."
        }
      ]
    }
  },
  {
    files: [
      "src/lib/automation/runService.ts",
      "src/lib/automation/dedup.ts",
      "scripts/automation-tests/support/testAutomationFactory.ts"
    ],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
