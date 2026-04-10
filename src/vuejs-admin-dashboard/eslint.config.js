import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    rules: {
      // Allow single-word component names (e.g. App.vue, Toast.vue)
      'vue/multi-word-component-names': 'off',
      // Warn on leftover console statements
      'no-console': 'warn',
      'no-debugger': 'error',
    },
  },
]
