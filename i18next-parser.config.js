module.exports = {
  locales: ['en', 'de'],
  input: ['src/**/*.{js,jsx,ts,tsx}'],
  output: 'public/locales/$LOCALE/$NAMESPACE.json',
  keepRemoved: false,
  sort: true,
};
