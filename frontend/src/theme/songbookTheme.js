import { createTheme } from '@mui/material/styles';

export const songbookColors = {
    primary: '#40372F',
    accent: '#A85D3A',
    background: '#F3EBDD',
    surface: '#FFF9EE',
    text: '#2C261F',
    textSecondary: '#5C534A',
    accentLight: '#C98464',
};

const sans = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const serif = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

const heading = {
    fontFamily: serif,
    fontWeight: 600,
    color: songbookColors.text,
};

export const songbookTheme = createTheme({
    palette: {
        primary: {
            main: songbookColors.primary,
            contrastText: songbookColors.surface,
        },
        secondary: {
            main: songbookColors.accent,
            light: songbookColors.accentLight,
            contrastText: songbookColors.surface,
        },
        background: {
            default: songbookColors.background,
            paper: songbookColors.surface,
        },
        text: {
            primary: songbookColors.text,
            secondary: songbookColors.textSecondary,
        },
        divider: 'rgba(64, 55, 47, 0.16)',
    },
    typography: {
        fontFamily: sans,
        h1: heading,
        h2: heading,
        h3: heading,
        h4: heading,
        h5: heading,
        h6: heading,
        button: {
            fontFamily: sans,
            textTransform: 'none',
            fontWeight: 600,
        },
    },
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: songbookColors.background,
                    color: songbookColors.text,
                },
            },
        },
        MuiAppBar: {
            defaultProps: {
                color: 'primary',
                elevation: 0,
            },
            styleOverrides: {
                colorPrimary: {
                    borderBottom: '1px solid rgba(255, 249, 238, 0.14)',
                    '& .MuiButtonBase-root.Mui-focusVisible': {
                        outlineColor: songbookColors.surface,
                    },
                },
            },
        },
        MuiButtonBase: {
            styleOverrides: {
                root: {
                    '&.Mui-focusVisible': {
                        outline: `2px solid ${songbookColors.accent}`,
                        outlineOffset: 2,
                    },
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    minHeight: 44,
                    borderRadius: 8,
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    width: 44,
                    height: 44,
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    minHeight: 44,
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: songbookColors.accent,
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    '&.Mui-focused': {
                        color: songbookColors.accent,
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
    },
});
