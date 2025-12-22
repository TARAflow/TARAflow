import {createTheme} from "@mui/material/styles";

const theme = createTheme({
    palette: {
        primary: {
            main: '#283593',
        },
        secondary: {
            main: '#9f3e72',
        },
        text: {
            primary: '#ffffff',
        }
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontSize: '3rem',
            fontWeight: 700,
            color: '#ffffff',
        },
        h4: {
            fontSize: '2rem',
            fontWeight: 500,
            color: '#ffffff',
        },
        h5: {
            fontSize: '1.5rem',
            fontWeight: 400,
            color: '#cfcfcf',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: '20px',
                    padding: '10px 20px',
                },
            },
        },
        MuiGrid: {
          styleOverrides: {
                root: {
                    minHeight: '100vh',
                    backgroundColor: '#1c2566'
                }
          }
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundColor: '#3f51b5',
                    padding: '20px',
                    marginTop: '20px',
                },
            },
        },
        MuiContainer: {
            styleOverrides: {
                root: {
                    padding: '40px',
                    borderRadius: '8px',
                    backgroundColor: '#3f51b5',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    width: '90%',
                    height: '90%'
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    backgroundColor: '#535da8',
                },
            },
        },
        MuiCheckbox: {
            styleOverrides: {
                root: {
                    color: '#f44336',
                    '&.Mui-checked': {color: '#f44336'}
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    color: '#f44336',
                },
            },
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    backgroundColor: '#535da8',
                    borderRadius: '8px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    marginTop: '8px',
                    paddingBlock: '8px'
                },
            },
        }
    },
});

export default theme;
