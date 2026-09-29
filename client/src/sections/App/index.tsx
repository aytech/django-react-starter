import { Container, CssBaseline, Typography } from '@mui/material';

import './styles.css';

export default function App() {
  return (
    <>
      <CssBaseline />
      <Container component="main" maxWidth="md" className="app">
        <Typography component="h1" variant="h4" gutterBottom>
          Django + React
        </Typography>
        <Typography>Your starter is ready.</Typography>
      </Container>
    </>
  );
}
