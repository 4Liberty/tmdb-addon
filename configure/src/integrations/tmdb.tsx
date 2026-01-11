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
  const [showApiKeyInput, setShowApiKeyInput] = useState(Boolean(tmdbApiKey));

  useEffect(() => {
    setTempApiKey(tmdbApiKey || "");
    setShowApiKeyInput(Boolean(tmdbApiKey));
  }, [tmdbApiKey]);

  const maybeRevealApiKeyInput = (message: string) => {
    if (!message) return;
    if (
      /TMDB_API not configured/i.test(message) ||
      /invalid api key|unauthorized|authentication failed|status\s*401|status\s*403|status code\s*401|status code\s*403/i.test(message)
    ) {
      setShowApiKeyInput(true);
    }
  };

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
      const base = `/session_id?request_token=${encodeURIComponent(requestToken)}`;
      const url = tmdbApiKey ? `${base}&api_key=${encodeURIComponent(tmdbApiKey)}` : base;

      const response = await fetch(url);
      if (!response.ok) {
        const message = await readErrorMessage(response);
        maybeRevealApiKeyInput(message);
        throw new Error(message || 'Failed to create session');
      }
      
      const sessionId = await response.text();
      if (!sessionId) throw new Error('Empty session id');
      setSessionId(sessionId);
      
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create TMDB session";
      maybeRevealApiKeyInput(message);
      setError(message);
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
      // If we already have a session, ignore the leftover token.
      if (sessionId) {
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
      handleRequestToken(requestToken);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleRequestToken, sessionId]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Persist config so oauth callback can restore it (including tmdbApiKey)
      saveConfigToStorage();

      const uuid = (globalThis.crypto as Crypto | undefined)?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const base = `/request_token?cache_buster=${encodeURIComponent(uuid)}`;
      const url = tmdbApiKey ? `${base}&api_key=${encodeURIComponent(tmdbApiKey)}` : base;

      const response = await fetch(url);
      if (!response.ok) {
        const message = await readErrorMessage(response);
        maybeRevealApiKeyInput(message);
        throw new Error(message || 'Failed to get request token');
      }
      
      const requestToken = await response.text();
      if (!requestToken) throw new Error('Empty request token');
      const redirectTo = `${window.location.origin}/configure/oauth-callback`;
      const tmdbAuthUrl = `https://www.themoviedb.org/authenticate/${requestToken}?redirect_to=${encodeURIComponent(redirectTo)}`;
      window.location.href = tmdbAuthUrl;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to start TMDB authentication";
      maybeRevealApiKeyInput(message);
      setError(message);
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setSessionId("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        {showApiKeyInput ? (
          <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
            <Label htmlFor="tmdbApiKey">TMDB API Key (v3) (only needed if server isn’t configured)</Label>
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
        ) : null}

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