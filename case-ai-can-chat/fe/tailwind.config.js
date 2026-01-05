/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				health: {
					purple: "#9000FF",
					"purple-light": "#A855F7",
					"purple-dark": "#7C3AED",
					"gradient-start": "#103284",
					"gradient-mid": "#3A2D9E",
					"gradient-end": "#74006D",
					white: "#ffffff",
					"gray-light": "#F5F5F5",
					"gray-beige": "#F8F7F5",
					"gray-medium": "#E0E0E0",
					"gray-text": "#4A4A4A",
				},
			},
			animation: {
				"pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
				"scroll-left": "scrollLeft 30s linear infinite",
				"scroll-left-slow": "scrollLeft 35s linear infinite",
				"scroll-left-slower": "scrollLeft 40s linear infinite",
			},
			keyframes: {
				scrollLeft: {
					"0%": { transform: "translateX(0%)" },
					"100%": { transform: "translateX(-50%)" },
				},
			},
		},
	},
	plugins: [],
};
