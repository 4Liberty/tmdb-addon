import { useState, useEffect, useCallback, useRef } from "react";
import { useConfig } from "@/contexts/ConfigContext";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

export default function TMDB() {
  const { sessionId, setSessionId, saveConfigToStorage, tmdbApiKey, setTmdbApiKey } = useConfig();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const popupCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tempApiKey, setTempApiKey] = useState(tmdbApiKey || "");

  useEffect(() => {
    setTempApiKey(tmdbApiKey || "");
  }, [tmdbApiKey]);

  const readErrorMessage = async (response: Response) => {
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await response.json();
        return body?.message || body?.error || JSON.stringify(body);
      }
    } catch {
      // ignore
    }

    try {
      const text = await response.text();
      return text || `Request failed (${response.status})`;
    } catch {
      return `Request failed (${response.status})`;
    }
  };

  const handleRequestToken = useCallback(async (requestToken: string) => {
    setIsLoading(true);
    setError("");
    try {
      if (!tmdbApiKey) {
        throw new Error('TMDB API key is missing. Add your TMDB API key first.');
      }

      const response = await fetch(
        `/session_id?request_token=${encodeURIComponent(requestToken)}&api_key=${encodeURIComponent(tmdbApiKey)}`
      );
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || 'Failed to create session');
      }
      
      const sessionId = await response.text();
      if (!sessionId) throw new Error('Empty session id');
      setSessionId(sessionId);
      
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create TMDB session");
    } finally {
      setIsLoading(false);
    }
  }, [setSessionId, tmdbApiKey]);

  useEffect(() => {
    // Escuta mensagens do popup OAuth
    const handleMessage = (event: MessageEvent) => {
      // Verifica a origem da mensagem por segurança
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'tmdb_oauth') {
        // Limpa o intervalo de verificação do popup
        if (popupCheckIntervalRef.current) {
          clearInterval(popupCheckIntervalRef.current);
          popupCheckIntervalRef.current = null;
        }
        handleRequestToken(event.data.requestToken);
      } else if (event.data.type === 'oauth_error') {
        // Limpa o intervalo de verificação do popup
        if (popupCheckIntervalRef.current) {
          clearInterval(popupCheckIntervalRef.current);
          popupCheckIntervalRef.current = null;
        }
        setError(event.data.errorDescription || event.data.error || 'Authentication failed');
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback: ainda verifica URL params caso não seja popup
    const urlParams = new URLSearchParams(window.location.search);
    const requestToken = urlParams.get('request_token');

    if (requestToken && !window.opener) {
      handleRequestToken(requestToken);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleRequestToken]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");

    if (!tmdbApiKey) {
      setError('TMDB API key is missing. Add your TMDB API key first.');
      setIsLoading(false);
      return;
    }

    try {
      // Persist config so oauth callback can restore it (including tmdbApiKey)
      saveConfigToStorage();

      const uuid = (globalThis.crypto as Crypto | undefined)?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const response = await fetch(
        `/request_token?api_key=${encodeURIComponent(tmdbApiKey)}&cache_buster=${encodeURIComponent(uuid)}`
      );
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || 'Failed to get request token');
      }
      
      const requestToken = await response.text();
      if (!requestToken) throw new Error('Empty request token');
      const tmdbAuthUrl = `https://www.themoviedb.org/authenticate/${requestToken}?redirect_to=${window.location.href}`;
      window.location.href = tmdbAuthUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start TMDB authentication");
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setSessionId("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
          <Label htmlFor="tmdbApiKey">TMDB API Key (v3)</Label>
          <Input
            id="tmdbApiKey"
            type="password"
            placeholder="Enter your TMDB API key"
            value={tempApiKey}
            onChange={(e) => {
              setTempApiKey(e.target.value);
              setError("");
            }}
            autoComplete="off"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTmdbApiKey(tempApiKey)}
              disabled={tempApiKey === tmdbApiKey}
            >
              Save Key
            </Button>
          </div>
        </form>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sessionId ? (
          <div className="flex flex-col items-center space-y-4">
            <Alert>
              <AlertDescription>
                You are logged in to TMDB
              </AlertDescription>
            </Alert>
            <DialogClose asChild>
              <Button variant="destructive" onClick={handleLogout}>
                Logout
              </Button>
            </DialogClose>
          </div>
        ) : (
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting to TMDB...
              </>
            ) : (
              'Login with TMDB'
            )}
          </Button>
        )}
      </div>
    </div>
  );
} 