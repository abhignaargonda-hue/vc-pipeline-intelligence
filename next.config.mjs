export default {
  reactStrictMode: true,
  // Gemini reads seed/company-profile.md and seed/signal-rubric.md at runtime
  outputFileTracingIncludes: { '/api/**': ['./seed/**'] },
};
