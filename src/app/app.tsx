import React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { MainLayout } from "app/components/layout/main-layout";

// Minimal MUI theme — primary purpose is to disable Popper's window resize
// listener globally. Without this, every Tooltip/Select/Menu re-render
// registers a new debounced resize listener without removing the old one,
// causing accumulation (242+ listeners observed in production).
const appTheme = createTheme({
  components: {
    MuiPopper: {
      defaultProps: {
        modifiers: [
          { name: "eventListeners", options: { resize: false } },
        ],
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <div className="App">
        <MainLayout />
      </div>
    </ThemeProvider>
  );
}

export default App;