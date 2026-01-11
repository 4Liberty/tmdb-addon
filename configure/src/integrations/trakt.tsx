import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig } from "@/contexts/ConfigContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function Trakt() {
  const {
    traktAccessToken,
    traktRefreshToken,
    setTraktAccessToken,
    setTraktRefreshToken,
    setCatalogs,
  } = useConfig();

  const { toast } = useToast();
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const popupCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleAccessToken = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError("");

      try {
        if (!code || !code.trim()) throw new Error("Invalid authorization code");

        const response = await fetch(`/trakt_access_token?code=${encodeURIComponent(code)}`);
        if (!response.ok) {
          const message = await readErrorMessage(response);
          throw new Error(message || "Failed to exchange Trakt code");
        }

        const tokenData = await response.json();
        if (!tokenData?.access_token) throw new Error("Missing access token");

        setTraktAccessToken(tokenData.access_token);
        if (tokenData.refresh_token) setTraktRefreshToken(tokenData.refresh_token);

        const traktCatalogsToAdd = [
          { id: "trakt.watchlist", type: "movie", name: "Trakt Watchlist", enabled: true, showInHome: true },
          { id: "trakt.watchlist", type: "series", name: "Trakt Watchlist", enabled: true, showInHome: true },
          { id: "trakt.recommendations", type: "movie", name: "Trakt Recommendations", enabled: true, showInHome: true },
          { id: "trakt.recommendations", type: "series", name: "Trakt Recommendations", enabled: true, showInHome: true },
        ];

        setCatalogs((prev) => {
          const existing = new Set(prev.map((c) => `${c.id}-${c.type}`));

          const updated = prev.map((c) => {
            const match = traktCatalogsToAdd.find((tc) => tc.id === c.id && tc.type === c.type);
            return match ? { ...c, enabled: true, showInHome: true } : c;
          });

          const missing = traktCatalogsToAdd.filter((c) => !existing.has(`${c.id}-${c.type}`));
          return [...updated, ...missing];
        });

        toast({
          title: "Trakt connected",
          description: "Watchlist and recommendations enabled.",
        });
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to connect Trakt");
      } finally {
        setIsLoading(false);
      }
    },
    [setCatalogs, setTraktAccessToken, setTraktRefreshToken, toast]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "trakt_oauth") {
        if (popupCheckIntervalRef.current) {
          clearInterval(popupCheckIntervalRef.current);
          popupCheckIntervalRef.current = null;
        }
        handleAccessToken(event.data.code);
      }

      if (event.data?.type === "oauth_error") {
        if (popupCheckIntervalRef.current) {
          clearInterval(popupCheckIntervalRef.current);
          popupCheckIntervalRef.current = null;
        }
        setIsLoading(false);
        setError(event.data.errorDescription || event.data.error || "Authentication failed");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleAccessToken]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/trakt_auth_url");
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || "Failed to get Trakt auth URL");
      }

      const data = await response.json();
      if (!data?.authUrl) throw new Error("Empty Trakt auth URL");

      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const popup = window.open(
        data.authUrl,
        "Trakt Authentication",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed) {
        setIsLoading(false);
        setError("Popup blocked. Please allow popups.");
        return;
      }

      popupCheckIntervalRef.current = setInterval(() => {
        if (popup.closed) {
          if (popupCheckIntervalRef.current) {
            clearInterval(popupCheckIntervalRef.current);
            popupCheckIntervalRef.current = null;
          }
          setIsLoading(false);
        }
      }, 1000);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to start Trakt authentication");
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setTraktAccessToken("");
    setTraktRefreshToken("");

    setCatalogs((prev) => prev.filter((c) => !c.id.startsWith("trakt.")));

    toast({
      title: "Trakt disconnected",
      description: "Trakt catalogs removed.",
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {traktAccessToken ? (
        <div className="flex flex-col items-center space-y-3">
          <Alert>
            <AlertDescription>You are connected to Trakt.</AlertDescription>
          </Alert>
          <DialogClose asChild>
            <Button variant="destructive" onClick={handleLogout}>
              Disconnect
            </Button>
          </DialogClose>
        </div>
      ) : (
        <Button onClick={handleLogin} disabled={isLoading} className="w-full">
          {isLoading ? "Connecting…" : "Connect with Trakt"}
        </Button>
      )}

      {/* keep refresh token unused for now */}
      {traktRefreshToken ? null : null}
    </div>
  );
}
