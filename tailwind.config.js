/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e14",
        surface: "#151a23",
        "surface-2": "#1e2530",
        text: "#e8ecf4",
        "text-dim": "#8b93a3",
        gold: "#fbbf24",
        danger: "#f87171",
      },
      borderRadius: { token: "14px" },
    },
  },
  plugins: [],
};
