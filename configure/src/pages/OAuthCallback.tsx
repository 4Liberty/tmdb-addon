import { useEffect } from "react";

const OAuthCallback = () => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    const requestToken = urlParams.get("request_token");
    const code = urlParams.get("code");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    if (window.opener && !window.opener.closed) {
      if (error) {
        window.opener.postMessage(
          {
            type: "oauth_error",
            error,
            errorDescription: errorDescription || "Authentication failed",
          },
          window.location.origin
        );
      } else if (requestToken) {
        window.opener.postMessage(
          {
            type: "tmdb_oauth",
            requestToken,
          },
          window.location.origin
        );
      } else if (code) {
        window.opener.postMessage(
          {
            type: "trakt_oauth",
            code,
          },
          window.location.origin
        );
      }

      window.close();
      return;
    }

    const currentUrl = window.location.href;
    if (currentUrl.includes("/oauth-callback")) {
      const params = window.location.search;
      window.location.href = `/configure${params}`;
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <p className="text-lg text-gray-600">Processing authentication…</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
