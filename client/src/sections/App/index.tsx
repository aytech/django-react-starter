import { Alert, CircularProgress, Container, CssBaseline, Snackbar, Typography } from '@mui/material'
import './styles.css'
import { useExampleText } from '../../lib/hooks/useExample'
import { useEffect, useState } from 'react'

export default function App() {

  const [apiErrorMessage, setApiErrorMessage] = useState<string>("")
  const [apiError, setApiError] = useState(false)
  const { data, error, isPending, isFetching, isRefetching, isError, refetch } = useExampleText()

  useEffect(() => {
    if (isError) {
      setApiErrorMessage(error.message)
      setApiError(isError)
    }
  }, [isError, error])

  const loadingMessage = isPending
    ? "Loading "
    : isRefetching
      ? "Refreshing"
      : isFetching
        ? "Loading"
        : ""


  return (
    <>
      <CssBaseline />
      <Container component="main" maxWidth="md" className="app">
        {data && (
          <>
            <Typography component="h1" variant="h4" gutterBottom>
              {data.name}
            </Typography>
            <Typography>{data.title}</Typography>
          </>
        )}
        <Snackbar
          open={isFetching}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
        >
          <Alert
            severity="info"
            variant="filled"
            role="status"
            icon={
              <CircularProgress
                color="inherit"
                size={18}
                thickness={5}
                aria-hidden="true"
              />
            }
            sx={{
              alignItems: 'center',
              borderRadius: 2,
              boxShadow: 4,
              minWidth: 240,
            }}
          >
            {loadingMessage} data from API...
          </Alert>
        </Snackbar>
        <Snackbar
          open={apiError}
          autoHideDuration={6000}
          onClose={() => setApiError(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="error"
            variant="filled"
            onClose={() => setApiError(false)}
          >
            {apiErrorMessage}
          </Alert>
        </Snackbar>
      </Container>
    </>
  )
}
