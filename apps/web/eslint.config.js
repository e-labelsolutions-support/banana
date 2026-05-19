import baseConfig, { restrictEnvAccess } from "@banana/eslint-config/base";
import nextjsConfig from "@banana/eslint-config/nextjs";
import reactConfig from "@banana/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
];
