export const colors = {
  paper: "#EEF2F7",
  surface: "#FFFFFF",
  graphite900: "#14181D",
  graphite700: "#2B323B",
  graphite500: "#5B6572",
  graphite300: "#8D97A3",
  steel200: "#D8DEE4",
  steel100: "#E9EDF1",
  amber: "#C97A1F",
  amberBright: "#E0982E",
  amber50: "#FBF1E4",
  amber600: "#A9670F",
  teal: "#1F7A72",
  tealBright: "#2A9C8F",
  teal50: "#E7F4F2",
  rust: "#B84A3E",
  rust50: "#FBEBE9",
  white: "#FFFFFF",
};

// Brand extensions (keys above are unchanged for backward compatibility).
colors.navy = "#0B1220";
colors.navyLight = "#16283F";
colors.gold = "#E8A33D";
colors.sky = "#3E7CB1";
colors.violet = "#6C5CE7";

export const gradients = {
  amber: [colors.amberBright, colors.amber],
  night: ["#1B2027", colors.graphite900],
  teal: [colors.tealBright, colors.teal],
  // Deep navy → steel blue → teal. The company "hero" gradient.
  hero: ["#0B1220", "#16283F", "#14524B"],
  gold: ["#F2B95C", "#C97A1F"],
  cardDark: ["#182233", "#0B1220"],
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 12, lg: 18, xl: 24, pill: 999 };

export const shadow = {
  soft: {
    shadowColor: "#14181D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  lifted: {
    shadowColor: "#14181D",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const motion = {
  springy: { damping: 15, stiffness: 180, mass: 0.5 },
  gentle: { damping: 20, stiffness: 120, mass: 0.6 },
  quick: 150,
  base: 250,
  slow: 400,
};

export const typography = {
  display: { fontWeight: "700" },
  body: { fontWeight: "400" },
  mono: { fontFamily: "monospace" },
};
